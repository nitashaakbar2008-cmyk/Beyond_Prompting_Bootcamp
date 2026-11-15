/* Entry point: map /admin (served by server.mjs) to the CRM route, then render. */
if(location.pathname.replace(/\/$/,'')==='/admin')history.replaceState(null,'','/#admin');
upd();route();
