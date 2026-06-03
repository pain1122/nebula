import { createSlice } from "@reduxjs/toolkit";

import { getPortfolioChartsData, getMarketChartsData } from './thunk';
export const initialState :any= {
  portfolioData: [],
  marketData: [],
  error: {}
};


const DashboardCryptoSlice = createSlice({
  name: 'DashboardCrypto',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getPortfolioChartsData.fulfilled, (state, action) => {
      state.portfolioData = action.payload;
    });
    builder.addCase(getPortfolioChartsData.rejected, (state:any, action:any) => {
      state.error = action.payload.error || null;
    });

    builder.addCase(getMarketChartsData.fulfilled, (state, action) => {
      state.marketData = action.payload;
    });
    builder.addCase(getMarketChartsData.rejected, (state:any, action:any) => {
      state.error = action.payload.error || null;
    });
  }
});

export default DashboardCryptoSlice.reducer;