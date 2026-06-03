import { createSlice } from "@reduxjs/toolkit";
import { getAllData, getAudiencesMetricsChartsData, getUserDeviceChartsData, getAudiencesSessionsChartsData } from './thunk';

export const initialState :any= {
  chartData: [],
  audiencesMetricsData: [],
  userDeviceData: [],
  audiencesSessionsData: [],
  error: {}
};

const DashboardAnalyticsSlice = createSlice({
  name: 'DashboardAnalytics',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getAllData.fulfilled, (state, action) => {
      state.chartData = action.payload;
    });
    builder.addCase(getAllData.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(getAudiencesMetricsChartsData.fulfilled, (state, action) => {
      state.audiencesMetricsData = action.payload;
    });
    builder.addCase(getAudiencesMetricsChartsData.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(getUserDeviceChartsData.fulfilled, (state, action) => {
      state.userDeviceData = action.payload;
    });
    builder.addCase(getUserDeviceChartsData.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(getAudiencesSessionsChartsData.fulfilled, (state, action) => {
      state.audiencesSessionsData = action.payload;
    });
    builder.addCase(getAudiencesSessionsChartsData.rejected, (state, action) => {
      state.error = action.error.message;
    });

  }
});

export default DashboardAnalyticsSlice.reducer;