import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import { runtimeConfig } from "./core/runtime/config";
import { applyColorPreference, normalizeColorPreference } from "./core";
import { initialState as initialLayoutState } from "./slices/layouts/reducer";
import { installSessionHistoryGuard } from "./modules/checkupino/auth/history";

installSessionHistoryGuard();

const initialColorPreference = normalizeColorPreference(initialLayoutState.layoutModeType);
const initiallyPrefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
applyColorPreference(document.documentElement, initialColorPreference, initiallyPrefersDark);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <Provider store={store}>
    <React.Fragment>
      <BrowserRouter basename={runtimeConfig.routerBase}>
        <App />
      </BrowserRouter>
    </React.Fragment>
  </Provider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
