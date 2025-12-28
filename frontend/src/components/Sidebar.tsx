// src/components/Sidebar.tsx
import { NavLink } from "react-router-dom";
const menuItems = [
  { to: "/users/new", icon: "ri-user-add-line", label: "افزودن کاربر" },
];
const Sidebar: React.FC = () => {
    return (
        <div className="app-menu navbar-menu">
            { /* LOGO */}
            <div className="navbar-brand-box">
                { /* Dark Logo*/}
                <a href="/" className="logo logo-dark">
                    <span className="logo-sm">
                        <img src="/assets/images/logo-sm.png" alt="" height="22" />
                    </span>
                    <span className="logo-lg">
                        <img src="/assets/images/logo-dark.png" alt="" height="17" />
                    </span>
                </a>
                { /* Light Logo*/}
                <a href="/" className="logo logo-light">
                    <span className="logo-sm">
                        <img src="/assets/images/logo-sm.png" alt="" height="22" />
                    </span>
                    <span className="logo-lg">
                        <img src="/assets/images/logo-light.png" alt="" height="17" />
                    </span>
                </a>
                <button type="button" className="btn btn-sm p-0 fs-20 header-item float-end btn-vertical-sm-hover" id="vertical-hover">
                    <i className="ri-record-circle-line" />
                </button>
            </div>

            <div id="scrollbar">
                <div className="container-fluid">

                    <div id="two-column-menu">
                    </div>

                    <ul className="navbar-nav" id="navbar-nav">
                        <li className="menu-title"><span>منو</span></li>

                        {menuItems.map((item) => (
                            <li className="nav-item" key={item.to}>
                                <NavLink
                                    to={item.to}
                                    className={({ isActive }) => `nav-link menu-link ${isActive ? "active" : ""}`}
                                >
                                    <i className={item.icon} /> <span>{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
                { /* Sidebar */}
            </div>

            <div className="sidebar-background" />
        </div>
    )
}

export default Sidebar
