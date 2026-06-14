import { createSlice, PayloadAction } from "@reduxjs/toolkit";
//constants
import {
  LAYOUT_DIRECTION_TYPES,
  LAYOUT_TYPES,
  LAYOUT_MODE_TYPES,
  LAYOUT_SIDEBAR_TYPES,
  LAYOUT_WIDTH_TYPES,
  LAYOUT_POSITION_TYPES,
  LAYOUT_TOPBAR_THEME_TYPES,
  LEFT_SIDEBAR_SIZE_TYPES,
  LEFT_SIDEBAR_VIEW_TYPES,
  LEFT_SIDEBAR_IMAGE_TYPES,
  PERLOADER_TYPES,
  SIDEBAR_VISIBILITY_TYPES
} from "../../Components/constants/layout"


export interface LayoutState {
  layoutDirectionType: LAYOUT_DIRECTION_TYPES.LTR | LAYOUT_DIRECTION_TYPES.RTL;
  layoutType: LAYOUT_TYPES.HORIZONTAL | LAYOUT_TYPES.VERTICAL | LAYOUT_TYPES.TWOCOLUMN | LAYOUT_TYPES.SEMIBOX;
  layoutModeType: LAYOUT_MODE_TYPES.LIGHTMODE | LAYOUT_MODE_TYPES.DARKMODE;
  leftSidebarType: LAYOUT_SIDEBAR_TYPES.LIGHT | LAYOUT_SIDEBAR_TYPES.DARK | LAYOUT_SIDEBAR_TYPES.GRADIENT | LAYOUT_SIDEBAR_TYPES.GRADIENT_2 | LAYOUT_SIDEBAR_TYPES.GRADIENT_3 | LAYOUT_SIDEBAR_TYPES.GRADIENT_4;
  layoutWidthType: LAYOUT_WIDTH_TYPES.FLUID | LAYOUT_WIDTH_TYPES.BOXED;
  layoutPositionType: LAYOUT_POSITION_TYPES.FIXED | LAYOUT_POSITION_TYPES.SCROLLABLE;
  topbarThemeType: LAYOUT_TOPBAR_THEME_TYPES.LIGHT | LAYOUT_TOPBAR_THEME_TYPES.DARK;
  leftsidbarSizeType: LEFT_SIDEBAR_SIZE_TYPES.DEFAULT | LEFT_SIDEBAR_SIZE_TYPES.COMPACT | LEFT_SIDEBAR_SIZE_TYPES.SMALLICON | LEFT_SIDEBAR_SIZE_TYPES.SMALLHOVER;
  leftSidebarViewType: LEFT_SIDEBAR_VIEW_TYPES.DEFAULT | LEFT_SIDEBAR_VIEW_TYPES.DETACHED;
  leftSidebarImageType: LEFT_SIDEBAR_IMAGE_TYPES.NONE | LEFT_SIDEBAR_IMAGE_TYPES.IMG1 | LEFT_SIDEBAR_IMAGE_TYPES.IMG2 | LEFT_SIDEBAR_IMAGE_TYPES.IMG3 | LEFT_SIDEBAR_IMAGE_TYPES.IMG4;
  preloader: PERLOADER_TYPES.ENABLE | PERLOADER_TYPES.DISABLE;
  sidebarVisibilitytype:  SIDEBAR_VISIBILITY_TYPES.SHOW | SIDEBAR_VISIBILITY_TYPES.HIDDEN;
}

const LAYOUT_STORAGE_KEY = "nebula.layout.settings";

const defaultLayoutState: LayoutState = {
  layoutDirectionType: LAYOUT_DIRECTION_TYPES.RTL,
  layoutType: LAYOUT_TYPES.VERTICAL,
  layoutModeType: LAYOUT_MODE_TYPES.LIGHTMODE,
  leftSidebarType: LAYOUT_SIDEBAR_TYPES.LIGHT,
  layoutWidthType: LAYOUT_WIDTH_TYPES.FLUID,
  layoutPositionType: LAYOUT_POSITION_TYPES.FIXED,
  topbarThemeType: LAYOUT_TOPBAR_THEME_TYPES.DARK,
  leftsidbarSizeType: LEFT_SIDEBAR_SIZE_TYPES.DEFAULT,
  leftSidebarViewType: LEFT_SIDEBAR_VIEW_TYPES.DETACHED,
  leftSidebarImageType: LEFT_SIDEBAR_IMAGE_TYPES.NONE,
  preloader: PERLOADER_TYPES.DISABLE,
  sidebarVisibilitytype: SIDEBAR_VISIBILITY_TYPES.SHOW
};

const pickStoredValue = <T extends string>(
  value: unknown,
  allowedValues: T[],
  fallback: T
): T => {
  return typeof value === "string" && allowedValues.includes(value as T)
    ? (value as T)
    : fallback;
};

const readStoredLayoutState = (): LayoutState => {
  if (typeof window === "undefined") {
    return defaultLayoutState;
  }

  try {
    const rawSettings = window.localStorage.getItem(LAYOUT_STORAGE_KEY);

    if (!rawSettings) {
      return defaultLayoutState;
    }

    const stored = JSON.parse(rawSettings) as Partial<LayoutState>;

    return {
      layoutDirectionType: pickStoredValue(
        stored.layoutDirectionType,
        Object.values(LAYOUT_DIRECTION_TYPES),
        defaultLayoutState.layoutDirectionType
      ),
      layoutType: pickStoredValue(
        stored.layoutType,
        Object.values(LAYOUT_TYPES),
        defaultLayoutState.layoutType
      ),
      layoutModeType: pickStoredValue(
        stored.layoutModeType,
        Object.values(LAYOUT_MODE_TYPES),
        defaultLayoutState.layoutModeType
      ),
      leftSidebarType: pickStoredValue(
        stored.leftSidebarType,
        Object.values(LAYOUT_SIDEBAR_TYPES),
        defaultLayoutState.leftSidebarType
      ),
      layoutWidthType: pickStoredValue(
        stored.layoutWidthType,
        Object.values(LAYOUT_WIDTH_TYPES),
        defaultLayoutState.layoutWidthType
      ),
      layoutPositionType: pickStoredValue(
        stored.layoutPositionType,
        Object.values(LAYOUT_POSITION_TYPES),
        defaultLayoutState.layoutPositionType
      ),
      topbarThemeType: pickStoredValue(
        stored.topbarThemeType,
        Object.values(LAYOUT_TOPBAR_THEME_TYPES),
        defaultLayoutState.topbarThemeType
      ),
      leftsidbarSizeType: pickStoredValue(
        stored.leftsidbarSizeType,
        Object.values(LEFT_SIDEBAR_SIZE_TYPES),
        defaultLayoutState.leftsidbarSizeType
      ),
      leftSidebarViewType: pickStoredValue(
        stored.leftSidebarViewType,
        Object.values(LEFT_SIDEBAR_VIEW_TYPES),
        defaultLayoutState.leftSidebarViewType
      ),
      leftSidebarImageType: pickStoredValue(
        stored.leftSidebarImageType,
        Object.values(LEFT_SIDEBAR_IMAGE_TYPES),
        defaultLayoutState.leftSidebarImageType
      ),
      preloader: pickStoredValue(
        stored.preloader,
        Object.values(PERLOADER_TYPES),
        defaultLayoutState.preloader
      ),
      sidebarVisibilitytype: pickStoredValue(
        stored.sidebarVisibilitytype,
        Object.values(SIDEBAR_VISIBILITY_TYPES),
        defaultLayoutState.sidebarVisibilitytype
      ),
    };
  } catch {
    window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    return defaultLayoutState;
  }
};

const persistLayoutState = (state: LayoutState) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
    layoutDirectionType: state.layoutDirectionType,
    layoutType: state.layoutType,
    layoutModeType: state.layoutModeType,
    leftSidebarType: state.leftSidebarType,
    layoutWidthType: state.layoutWidthType,
    layoutPositionType: state.layoutPositionType,
    topbarThemeType: state.topbarThemeType,
    leftsidbarSizeType: state.leftsidbarSizeType,
    leftSidebarViewType: state.leftSidebarViewType,
    leftSidebarImageType: state.leftSidebarImageType,
    preloader: state.preloader,
    sidebarVisibilitytype: state.sidebarVisibilitytype,
  }));
};

export const initialState: LayoutState = readStoredLayoutState();

const LayoutSlice = createSlice({
  name: 'LayoutSlice',
  initialState,
  reducers: {
    changeLayoutDirectionAction(state, action: PayloadAction<LayoutState["layoutDirectionType"]>) {
      state.layoutDirectionType = action.payload;
      persistLayoutState(state);
    },
    changeLayoutAction(state, action : PayloadAction<LayoutState["layoutType"]>) {
      state.layoutType = action.payload;
      persistLayoutState(state);
    },
    changeLayoutModeAction(state, action: PayloadAction<LayoutState["layoutModeType"]>) {
      state.layoutModeType = action.payload;
      persistLayoutState(state);
    },
    changeSidebarThemeAction(state, action: PayloadAction<LayoutState["leftSidebarType"]>) {
      state.leftSidebarType = action.payload;
      persistLayoutState(state);
    },
    changeLayoutWidthAction(state, action: PayloadAction<LayoutState["layoutWidthType"]>) {
      state.layoutWidthType = action.payload;
      persistLayoutState(state);
    },
    changeLayoutPositionAction(state, action: PayloadAction<LayoutState["layoutPositionType"]>) {
      state.layoutPositionType = action.payload;
      persistLayoutState(state);
    },
    changeTopbarThemeAction(state, action: PayloadAction<LayoutState["topbarThemeType"]>) {
      state.topbarThemeType = action.payload;
      persistLayoutState(state);
    },
    changeLeftsidebarSizeTypeAction(state, action: PayloadAction<LayoutState["leftsidbarSizeType"]>) {
      state.leftsidbarSizeType = action.payload;
      persistLayoutState(state);
    },
    changeLeftsidebarViewTypeAction(state, action: PayloadAction<LayoutState["leftSidebarViewType"]>) {
      state.leftSidebarViewType = action.payload;
      persistLayoutState(state);
    },
    changeSidebarImageTypeAction(state, action: PayloadAction<LayoutState["leftSidebarImageType"]>) {
      state.leftSidebarImageType = action.payload;
      persistLayoutState(state);
    },
    changePreLoaderAction(state, action: PayloadAction<LayoutState["preloader"]>) {
      state.preloader = action.payload;
      persistLayoutState(state);
    },
    changeSidebarVisibilityAction(state, action: PayloadAction<LayoutState["sidebarVisibilitytype"]>) {
      state.sidebarVisibilitytype = action.payload;
      persistLayoutState(state);
    },
  }
});

export const {
  changeLayoutDirectionAction,
  changeLayoutAction,
  changeLayoutModeAction,
  changeSidebarThemeAction,
  changeLayoutWidthAction,
  changeLayoutPositionAction,
  changeTopbarThemeAction,
  changeLeftsidebarSizeTypeAction,
  changeLeftsidebarViewTypeAction,
  changeSidebarImageTypeAction,
  changePreLoaderAction,
  changeSidebarVisibilityAction
} = LayoutSlice.actions;

export default LayoutSlice.reducer;
