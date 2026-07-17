import React from 'react';
import { Routes, Route } from "react-router-dom";

//Layouts
import NonAuthLayout from "../Layouts/NonAuthLayout";
import VerticalLayout from "../Layouts/index";

//routes
import { authProtectedRoutes, publicRoutes } from "./allRoutes";
import AuthProtected  from './AuthProtected';

const routeFallback = (
    <div className="d-flex justify-content-center align-items-center py-4">
        <div className="spinner-border text-primary" role="status" aria-hidden="true"></div>
    </div>
);

const Index = () => {
    return (
        <React.Fragment>
            <Routes>
                <Route>
                    {publicRoutes.map((route, idx) => (
                        <Route
                            path={route.path}
                            element={
                                <NonAuthLayout>
                                    <React.Suspense fallback={routeFallback}>
                                        {route.component}
                                    </React.Suspense>
                                </NonAuthLayout>
                            }
                            key={idx}
                        />
                    ))}
                </Route>

                <Route>
                    {authProtectedRoutes.map((route, idx) => (
                        <Route
                            path={route.path}
                            element={
                                <AuthProtected allowedRoles={route.allowedRoles}>
                                    <VerticalLayout>
                                        <React.Suspense fallback={routeFallback}>
                                            {route.component}
                                        </React.Suspense>
                                    </VerticalLayout>
                                </AuthProtected>}
                            key={idx}
                        />
                    ))}
                </Route>
            </Routes>
        </React.Fragment>
    );
};

export default Index;
