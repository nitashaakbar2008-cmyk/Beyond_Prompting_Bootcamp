/* Browser helper for the shared-database API (server-side: data-api/db-routes.mjs). INDEPENDENT ADD-ON: the existing storefront and CRM
   do not load or call this file, so they still use LocalStorage. It contains no keys. Include it with a <script> tag in a NEW page to use it. */
(function(){var base=window.LUMIERE_DB_BASE||'/api/db',token=null;
function call(path,method,body,auth){var h={'Content-Type':'application/json'};if(auth&&token)h.Authorization='Bearer '+token;
  return fetch(base+path,{method:method||'GET',headers:h,body:body?JSON.stringify(body):undefined}).then(function(r){return r.json().catch(function(){return null}).then(function(j){if(!r.ok){var e=new Error((j&&j.error)||('http_'+r.status));e.status=r.status;throw e}return j})})}
window.LumiereDB={
  products:function(){return call('/products')},reviews:function(pid){return call('/reviews'+(pid?'?product_id='+encodeURIComponent(pid):''))},
  placeOrder:function(customer,items,notes){return call('/orders','POST',{customer:customer,items:items,notes:notes})},
  submitInquiry:function(i){return call('/inquiries','POST',i)},subscribe:function(email){return call('/newsletter','POST',{email:email})},
  submitReview:function(r){return call('/reviews','POST',r)},
  admin:{login:function(email,password){return call('/admin/login','POST',{email:email,password:password}).then(function(j){token=j.access_token;return true})},
    logout:function(){token=null},list:function(t){return call('/admin/'+t,'GET',null,true)},update:function(t,id,patch){return call('/admin/'+t+'/'+encodeURIComponent(id),'PATCH',patch,true)}}};
})();
