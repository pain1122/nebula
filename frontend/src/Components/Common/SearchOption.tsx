import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from 'reactstrap';

//SimpleBar
import SimpleBar from "simplebar-react";

import Navdata from 'Layouts/LayoutMenuData';

const SearchOption = () => {

    const navData = Navdata().props.children;
    const [searchTerm, setSearchTerm] = useState('');
    const [filterData, setFilterData] = useState([]);
    
    useEffect(() => {
      const searchOptions = document.getElementById("search-close-options") as HTMLElement;
      const dropdown = document.getElementById("search-dropdown") as HTMLElement;
      const searchInput = document.getElementById("search-options") as HTMLInputElement;
    
      const handleSearchInput = () => {
        const inputLength = searchInput.value.length;
        if (inputLength > 0) {
          dropdown.classList.add("show");
          searchOptions.classList.remove("d-none");
        } else {
          dropdown.classList.remove("show");
          searchOptions.classList.add("d-none");
        }
      };
    
      searchInput.addEventListener("focus", handleSearchInput);
      searchInput.addEventListener("keyup", handleSearchInput);
    
      searchOptions.addEventListener("click", () => {
        searchInput.value = "";
        dropdown.classList.remove("show");
        searchOptions.classList.add("d-none");
      });
    
      document.body.addEventListener("click", (e: any) => {
        if (e.target.getAttribute('id') !== "search-options") {
          dropdown.classList.remove("show");
          searchOptions.classList.add("d-none");
        }
      });
    }, [searchTerm]);
    
    const onKeyDownPress = (e : any) => {
        const  { key} = e;
        if(key === "Enter"){
            e.preventDefault();
            setSearchTerm(e.target.value);
        }
    }
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        setSearchTerm(event.target.value);
    };
    
    // Filter routes based on search term
    useEffect(() => {
      const filteredMenuItems = navData.reduce((result: any, menuItem: any) => {
        const lowercaseLabel = menuItem.label ? menuItem.label.toLowerCase() : '';
        const lowercaseLink = menuItem.link ? menuItem.link.toLowerCase() : '';
    
        if (
          lowercaseLabel.includes(searchTerm.toLowerCase()) ||
          lowercaseLink.includes(searchTerm.toLowerCase())
        ) {
          result.push(menuItem);
        }
    
        const filteredSubItems = (menuItem.subItems || []).filter((subItem: any) => {
          const lowercaseSubItemLabel = subItem.label ? subItem.label.toLowerCase() : '';
          const lowercaseSubItemLink = subItem.link ? subItem.link.toLowerCase() : '';
    
          return (
            lowercaseSubItemLabel.includes(searchTerm.toLowerCase()) ||
            lowercaseSubItemLink.includes(searchTerm.toLowerCase())
          );
        });
    
        if (filteredSubItems.length > 0) {
          const menuItemWithSubItems = { ...menuItem, subItems: filteredSubItems };
          result.push(menuItemWithSubItems);
        }
    
        return result;
      }, []);
    
      setFilterData(filteredMenuItems);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);
      
    return (
        <React.Fragment>
            <form className="app-search d-none d-md-block">
                <div className="position-relative">
                    <Input type="text" className="form-control" placeholder="Search..."
                        id="search-options"
                        value={searchTerm}
                        onKeyDown={onKeyDownPress}
                        onChange={handleChange} />
                    <span className="mdi mdi-magnify search-widget-icon"></span>
                    <span className="mdi mdi-close-circle search-widget-icon search-widget-icon-close d-none"
                        id="search-close-options"></span>
                </div>
                <div className="dropdown-menu dropdown-menu-lg" id="search-dropdown">
                    <SimpleBar style={{ height: "320px" }}>

                        {/* <div className="dropdown-header">
                            <h6 className="text-overflow text-muted mb-0 text-uppercase">Recent Searches</h6>
                        </div> */}

                        <div className="dropdown-header mt-2">
                            <h6 className="text-overflow text-muted mb-1 text-uppercase">Pages</h6>
                        </div>


                        {filterData.map((menuItem  :any, index) => (
                        <React.Fragment key={index}>
                            {!menuItem.subItems ? (
                            <Link to={menuItem.link} className="dropdown-item notify-item">
                                    <i className={menuItem.icon + " align-middle fs-xl text-muted me-2"}></i>
                                    <span>{menuItem.label}</span>
                            </Link>
                            ) : (
                                <div className="dropdown-header mt-2">
                                <h6 className="text-overflow text-muted mb-1 text-uppercase">{menuItem.label}</h6>
                            </div>
                            )}
                            {menuItem.subItems && menuItem.subItems.length > 0 && (
                            <>
                                {menuItem.subItems.map((subItem : any, subIndex : number) => (
                                 <Link key={subIndex} to={subItem.link} className="dropdown-item notify-item">
                                    <i className={menuItem.icon + " align-middle fs-xl text-muted me-2"}></i>
                                    <span>{subItem.label}</span>
                                </Link>
                                ))}
                            </>
                            )}
                        </React.Fragment>
                        ))}
                    </SimpleBar>
                </div>
            </form>
        </React.Fragment>
    );
};

export default SearchOption;
