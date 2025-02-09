import { isPlatformServer } from '@angular/common';
import { inject, Injectable, makeStateKey, PLATFORM_ID, TransferState } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom, mapResponse } from '@ngrx/operators';
import { select, Store } from '@ngrx/store';
import { distinctUntilChanged, exhaustMap, filter, first, map, of, scan, switchMap, takeWhile, tap } from 'rxjs';
import { ToastsFacade } from 'src/app/toasts/state/toasts.facade';

import { ClipsApiService, PAGE_SIZE } from '../services/clips-api.service';
import * as ClipsActions from './clips.actions';
import { ClipsEntity } from './clips.models';
import * as fromClips from './clips.reducer';
import * as ClipsSelectors from './clips.selectors';
import { selecClipsCount } from './clips.selectors';

const CLIPS_STATE_KEY = makeStateKey<ClipsEntity[]>('TRANSFERED_STATE');

@Injectable()
export class ClipsEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store<fromClips.ClipsState>);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly transferState = inject(TransferState);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly clipsApiService = inject(ClipsApiService);
  private readonly toastsFacade = inject(ToastsFacade);

  private readonly initialId$ = this.router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    first(),
    map(() => {
      let route = this.route;

      while (route.firstChild) {
        route = route.firstChild;
      }

      return route;
    }),
    map((route) => route.snapshot.params),
    map((params) => params['id']),
  );

  private readonly lastPageLoaded$ = this.store.pipe(
    select(ClipsSelectors.selectActiveItemIdx),
    filter((activeItemIdx) => activeItemIdx !== null),
    map((activeItemIdx) => Math.floor(activeItemIdx / PAGE_SIZE)),
    scan((prev, curr) => (curr > prev ? curr : prev)),
    distinctUntilChanged(),
  );

  readonly loadInitialPost$ = createEffect(() => {
    return this.initialId$.pipe(
      switchMap((name) => {
        const transferedItems = this.transferState.get(CLIPS_STATE_KEY, []);

        if (transferedItems.length > 0) {
          return of(ClipsActions.setTransferedState({ items: transferedItems }));
        }

        return this.clipsApiService.getInitialPost(name).pipe(
          mapResponse({
            next: (item) => ClipsActions.loadInitialClipSuccess({ item }),
            error: (error) => ClipsActions.loadInitialClipFailure({ error }),
          }),
        );
      }),
    );
  });

  readonly loadInitialPostSuccess$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ClipsActions.loadInitialClipSuccess),
      map(({ item }) => ClipsActions.loadNextPage({ after: item.data.name })),
    );
  });

  readonly loadNextPage$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ClipsActions.loadNextPage),
      concatLatestFrom(() => this.store.select(selecClipsCount)),
      exhaustMap(([{ after }, count]) =>
        this.clipsApiService.getPosts(after, count).pipe(
          mapResponse({
            next: (items) => ClipsActions.loadNextPageSuccess({ items }),
            error: (error) => ClipsActions.loadNextPageFailure({ error }),
          }),
        ),
      ),
    );
  });

  readonly loadNextPageByLimit$ = createEffect(() => {
    return this.lastPageLoaded$.pipe(
      filter(Boolean),
      concatLatestFrom(() => this.store.select(ClipsSelectors.selectActiveItem)),
      switchMap(([_pageNumber, activeItem]) =>
        this.clipsApiService.getPosts(activeItem?.data.name).pipe(
          mapResponse({
            next: (items) => ClipsActions.loadNextPageSuccess({ items }),
            error: (error) => ClipsActions.loadNextPageFailure({ error }),
          }),
        ),
      ),
    );
  });

  readonly setTranseferedState$ = createEffect(
    () => {
      return this.store.pipe(select(ClipsSelectors.selectAllClips)).pipe(
        takeWhile(() => isPlatformServer(this.platformId)),
        tap((items) => this.transferState.set(CLIPS_STATE_KEY, items)),
      );
    },
    { dispatch: false },
  );

  readonly handleError$ = createEffect(
    () => {
      return this.actions$.pipe(
        ofType(ClipsActions.loadInitialClipFailure, ClipsActions.loadNextPageFailure),
        tap(({ error }) => {
          console.error(error);

          const message =
            error instanceof Error
              ? error.message
              : 'Something went wrong while loading the data. Please try again later.';

          this.toastsFacade.showToast({ message, type: 'error', autoDismissTime: null });
        }),
      );
    },
    { dispatch: false },
  );

  readonly redirectToActiveItem$ = createEffect(
    () => {
      return this.store.pipe(select(ClipsSelectors.selectActiveItem)).pipe(
        filter(Boolean),
        tap((activeItem) => this.router.navigate(['/clips', activeItem.data.id])),
      );
    },
    { dispatch: false },
  );
}
