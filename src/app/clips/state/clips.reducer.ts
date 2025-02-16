import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { Action, createReducer, on } from '@ngrx/store';

import * as ClipsActions from './clips.actions';
import { ClipsEntity } from './clips.models';

export const CLIPS_FEATURE_KEY = 'clips';

export interface ClipsState extends EntityState<ClipsEntity> {
  activeItemIdx: number | null; // which Clips record has been selected
}

export interface ClipsPartialState {
  readonly [CLIPS_FEATURE_KEY]: ClipsState;
}

export const clipsAdapter: EntityAdapter<ClipsEntity> = createEntityAdapter<ClipsEntity>({
  selectId: (item) => item.data.name,
});

export const initialClipsState: ClipsState = clipsAdapter.getInitialState({
  // set initial required properties
  activeItemIdx: null,
});

const reducer = createReducer(
  initialClipsState,

  on(ClipsActions.setTransferedState, (state, { items }) => clipsAdapter.setAll(items, { ...state, activeItemIdx: 0 })),

  on(ClipsActions.loadInitialClipSuccess, (state, { item }) =>
    clipsAdapter.addOne(item, { ...state, activeItemIdx: 0 }),
  ),

  on(ClipsActions.loadNextPageSuccess, (state, { items }) => clipsAdapter.addMany(items, state)),

  on(ClipsActions.showPrevItem, (state) => {
    if (!state.activeItemIdx) {
      return state;
    }

    return {
      ...state,
      activeItemIdx: Math.max(0, state.activeItemIdx - 1),
    };
  }),

  on(ClipsActions.showNextItem, (state) => {
    if (state.activeItemIdx === null || !state.ids.length) {
      return state;
    }

    return {
      ...state,
      activeItemIdx: Math.min(state.activeItemIdx + 1, state.ids.length - 1),
    };
  }),
);

export function clipsReducer(state: ClipsState | undefined, action: Action) {
  return reducer(state, action);
}
