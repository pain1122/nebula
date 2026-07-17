import React from "react";
import { useNavigate } from "react-router-dom";

import { useProfile } from "../Components/Hooks/UserHooks";
import { useDevToolboxMenu } from "../devtools/toolboxMenu";
import { productAdminMenuItems } from "../panel/menu";

const Navdata = () => {
    const history = useNavigate();
    const { userProfile } = useProfile();
    const isRootAdmin = userProfile?.roles.includes("root-admin") ?? false;
    const devToolboxMenuItems = useDevToolboxMenu({ history, isRootAdmin });

    return <React.Fragment>{[...productAdminMenuItems, ...devToolboxMenuItems]}</React.Fragment>;
};

export default Navdata;
