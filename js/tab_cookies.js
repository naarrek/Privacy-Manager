const checkPermission = chrome.permissions.contains;
const removePermission = chrome.permissions.remove;
const requestPermission = chrome.permissions.request;
const permissionRemoved = chrome.permissions.onRemoved;
const permissionAdded = chrome.permissions.onAdded;
var additionalPermission = {"origins": ["http://*/*", "https://*/*"]};

function comparePermissions(permissionObj)
{
  for (var i = 0; i < additionalPermission.origins.length; i++)
    if (permissionObj.origins.indexOf(additionalPermission.origins[i]) == -1)
      return false;
  return true;
}

function updateSwitches(list, value)
{
  list.forEach(function(switchBtn)
  {
    switchBtn.setAttribute("aria-checked", value);
  });
}

document.addEventListener("DOMContentLoaded" , function()
{
  var permissionSwitches = getSwitches("allowHost");
  checkPermission(additionalPermission, function(result)
  {
    if (result)
      loadCookies();

    permissionSwitches.forEach(function(switchBtn)
    {
      switchBtn.setAttribute("aria-checked", result);
    });
  });

  permissionSwitches.forEach(function(switchBtn)
  {
    switchBtn.addEventListener("click", function()
    {
      checkPermission(additionalPermission, function(result)
      {
        if (result)
          removePermission(additionalPermission);
        else
          requestPermission(additionalPermission);
      });
    }, false);
  });

  permissionRemoved.addListener(function(permission)
  {
    updateSwitches(permissionSwitches, false);
  });

  permissionAdded.addListener(function(permission)
  {
    updateSwitches(permissionSwitches, true);
    loadCookies();
  });

  Elem("#cookiesContainer").addEventListener("click", onCookiesClick, false);
}, false);

function loadCookies()
{
  chrome.cookies.getAll({}, function(cookies)
  {
    var domains = [];
    for (var i = 0; i < cookies.length; i++)
      domains.push(cookies[i].domain.replace(/^\./, ""));

    domains.sort();

    var templateContent = Elem("#cookiesListTemplate").content;
    var lastDomain = domains[0];
    var cookiesNumber = 1;
    for (var i = 1; i < domains.length; i++)
    {
      var domain = domains[i];
      if (lastDomain != domain)
      {
        var domainListElem = templateContent.querySelector("li");
        var domainNameElem = templateContent.querySelector(".domainName");
        var cookiesNumberElem = templateContent.querySelector(".cookiesNumber");
        
        domainListElem.setAttribute("data-domain", lastDomain);
        domainNameElem.textContent = lastDomain;
        cookiesNumberElem.textContent = cookiesNumber + " Cookies";

        var listElem = document.importNode(templateContent, true);
        Elem("#cookiesContainer").appendChild(listElem);

        lastDomain = domain;
        cookiesNumber = 1;
      }
      else
      {
        cookiesNumber++;
      }
    }
    var templateContent = Elem("#cookiesListTemplate").content;
    return;
    for (var i = 0; i < cookies.length; i++)
    {
      var cookie = cookies[i];
      var domain = cookie.domain;
      var expirationDate = cookie.expirationDate;
      var hostOnly = cookie.hostOnly;
      var httpOnly = cookie.httpOnly;
      var name = cookie.name;
      var path = cookie.path;
      var sameSite = cookie.sameSite;
      var secure = cookie.secure;
      var session = cookie.session;
      var storeId = cookie.storeId;
      var value = cookie.value;

      templateContent.querySelector("li").id = "cookieId-" + i;

    }
  });
}

function onCookiesClick(e)
{
  var element = e.target;
  var cookieElement = null;
  var action = null;
  var domain = null;
  var cookie = null;
  var path = null;
  var secure = false;

  while (true)
  {
    if (element == this)
      return;

    if (element.hasAttribute("data-action"))
      action = action == null ? element.getAttribute("data-action") : action;

    if (element.hasAttribute("data-cookie"))
    {
      cookie = element.getAttribute("data-cookie");
      cookieElement = element;
    }

    if (element.hasAttribute("data-secure"))
      secure = element.getAttribute("data-secure") == "true";

    if (element.hasAttribute("data-path"))
      path = element.getAttribute("data-path");

    if (element.hasAttribute("data-domain"))
    {
      domain = element.getAttribute("data-domain");
      break;
    }

    element = element.parentElement;
  }

  if (action == "get-cookies")
  {
    if (element.dataset.expanded == "true")
    {
      var sublistElem = element.querySelector("ul");
      sublistElem.parentNode.removeChild(sublistElem);
      element.dataset.expanded = false;
      return;
    }
    chrome.cookies.getAll({"domain": domain}, function(cookies)
    {
      var listElem = document.createElement("ul");
      for (var i = 0; i < cookies.length; i++)
      {
        var cookie = cookies[i];
        var templateContent = Elem("#cookiesSubListTemplate").content;

        var cookieListElem = templateContent.querySelector("li");
        var cookieNameElem = templateContent.querySelector(".cookieName");
        var cookieValueElem = templateContent.querySelector(".cookieValue");
        
        cookieListElem.setAttribute("data-cookie", cookie.name);
        cookieListElem.setAttribute("data-secure", cookie.secure);
        cookieListElem.setAttribute("data-path", cookie.path);
        cookieNameElem.textContent = cookie.name;
        cookieValueElem.textContent = cookie.value;

        var listItem = document.importNode(templateContent, true);
        listElem.appendChild(listItem);
      }
      element.dataset.expanded = true;
      element.appendChild(listElem);
    });
  }
  else if (action == "delete-domain-cookies")
  {
    chrome.cookies.getAll({"domain": domain}, function(cookies)
    {
      var callbackCount = 0;
      for (var i = 0; i < cookies.length; i++)
      {
        removeCookie(cookies[i], function()
        {
          callbackCount++;
          if (cookies.length == callbackCount)
            element.parentNode.removeChild(element);
        });
      }
    });
  }
  else if (action == "delete-cookie")
  {
    var url = "http" + (secure ? "s" : "") + "://" + domain + path;
    chrome.cookies.remove({"url": url, "name": cookie}, function(cookie)
    {
      if (cookieElement.parentNode.querySelectorAll("li").length == 1)
        element.parentNode.removeChild(element);
      else
        cookieElement.parentNode.removeChild(cookieElement);
    });
  }
}

function removeCookie(cookie, callback)
{
  var url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain +
            cookie.path;
  chrome.cookies.remove({"url": url, "name": cookie.name}, callback);
}


var cookiesTab =
{
  switchers: ["allowHostPermissions", "activeTabCookies"],
  
  init: function()
  {
    this.updateSwitchStates();
    this.addSwitchListener();
  },
  
  updateSwitchStates: function()
  {
    var updateActiveTabState = function()
    {
      var settingsJson = JSON.parse(localStorage.getItem("settings"));
      if (settingsJson.activeTabCookies == null)
      {
        settingsJson.activeTabCookies = false;
        localStorage.setItem("settings", JSON.stringify(settingsJson));
        switcher.changeState(Elem("#activeTabCookies .switch"), false);
      }
      else if (settingsJson.activeTabCookies == false)
        switcher.changeState(Elem("#activeTabCookies .switch"), false);
      else
        switcher.changeState(Elem("#activeTabCookies .switch"), true);
    };

    chrome.permissions.contains({origins: ['http://*/*', 'https://*/*']}, function(result) 
    {
      switcher.changeState(Elem("#allowHostPermissions .switch"), result);
      if (result)
      {
        Elem("#searchCookies").disabled = false;
        Elem("#removeAllCookies").disabled = false;
        switcher.enable(Elem("#activeTabCookies .switch"));
        updateActiveTabState();
        this.loadCookies();
        //getCookies();
      }
      else
      {
        Elem("#searchCookies").disabled = true;
        Elem("#removeAllCookies").disabled = true;
        switcher.disable(Elem("#activeTabCookies .switch"));
      }
    }.bind(this));
  },
  
  addSwitchListener: function()
  {
    Elem("#allowHostPermissions .switch").addEventListener("click", function(ev)
    {
      var state = switcher.toggleState.call(this, ev);
      if (state)
        chrome.permissions.request({origins: ['http://*/*', 'https://*/*']}, cookiesTab.updateSwitchStates);
      else
        chrome.permissions.remove({origins: ['http://*/*', 'https://*/*']}, cookiesTab.updateSwitchStates);
    }, false);
    
    Elem("#activeTabCookies .switch").addEventListener("click", function(ev)
    {
      var state = switcher.toggleState.call(this, ev);
      var settingsJson = JSON.parse(localStorage.getItem("settings"));
      settingsJson.activeTabCookies = state;
      localStorage.setItem("settings", JSON.stringify(settingsJson));
      cookiesTab.updateSwitchStates();
    }, false);
  },
  
  addCookieItem: function()
  {
    
  },
  
  loadCookies: function()
  {
    var sort_by = function(field, reverse, primer)
    {
       var key = function (x) 
       {
         return primer ? primer(x[field]) : x[field]
       };
       
       return function (a, b)
       {
           var A = key(a), B = key(b);
           return ((A < B) ? -1 :
                   (A > B) ? +1 : 0) * [-1,1][+!!reverse];                  
       }
    };
    
    var generateCookiesList = function(cookiesArray)
    {
      cookiesArray.sort(sort_by('domain', true, function(a){return a.toUpperCase()}));
      var lastDomainName = "";
      var firstDomainId = 0;
      var cookieCounter = 1;
      
      for (var i=0; i < cookiesArray.length; i++)
      {
        if (lastDomainName != cookiesArray[i].domain)
        {
          if (lastDomainName != "")
          {
            $("#cookieHostRowContainer_"+(firstDomainId)+" .cookieHostRowCounter").html(cookieCounter+" "+chrome.i18n.getMessage("cookiesCounterName"));
            cookieCounter=1;
          }
          firstDomainId = i;
          var cookieHostRow = "<div id='cookieHostRowContainer_"+i+"'><div class='cookieHostRow'><div class='cookieHostRowName'>"+cookiesArray[i].domain+"</div><div class='cookieHostRowCounter'></div><div id='cookieHostRowRemove_"+i+"' class='cookieHostRowRemove'>x</div></div></div>";
          $("#cookiesContainer").append(cookieHostRow);
          var cookieNameRow = "<div id='cookieNameRow_"+i+"' class='cookieNameRow' title='"+generateCookieTitleDetails(cookiesArray[i])+"'><div class='cookieNameRowName'>"+cookiesArray[i].name+"</div></div>";
          $("#cookieHostRowContainer_"+i).append(cookieNameRow);
          
          $("#cookieHostRowContainer_"+i+"").click(function(){
                cookieHostRowClicked(this);
            });
            
            $("#cookieHostRowRemove_"+i).click(function(){
              cookieRemove(this, "host");
            });
        }
        else {
          cookieCounter++;
          var cookieNameRow = "<div id='cookieNameRow_"+i+"' class='cookieNameRow' title='"+generateCookieTitleDetails(cookiesArray[i])+"'><div class='cookieNameRowName'>"+cookiesArray[i].name+"</div></div>";
          $("#cookieHostRowContainer_"+firstDomainId).append(cookieNameRow);
        }
        
        var cookieNameRowValue = "<div class='cookieNameRowValue'>"+cookiesArray[i].value+"</div>";
        var cookieNameRowRemove = "<div id='cookieNameRowRemove_"+i+"' class='cookieNameRowRemove'>x</div>"; 
        $("#cookieNameRow_"+i).append(cookieNameRowValue);
        $("#cookieNameRow_"+i).append(cookieNameRowRemove);
        
        $("#cookieNameRowRemove_"+i).click(function(){
            cookieRemove(this, "name");
          });
        
        lastDomainName = cookiesArray[i].domain; 
      };
      $("#cookieHostRowContainer_"+(firstDomainId)+" .cookieHostRowCounter").html(cookieCounter+" "+chrome.i18n.getMessage("cookiesCounterName"));
    };
    
    Elem("#cookiesContainer").innerHTML = "";
  
    var cookiesArray = new Array();
    chrome.cookies.getAll({}, function(cookies)
    {
      //TODO make query with domain
      for (var i in cookies) 
      {
        var patt = new RegExp(Elem("#searchCookies").value);
        if(patt.test(cookies[i].domain))
        {
          //TODO while leading "." in cookies mean that the cookie apply also fo subdomains then we need another option that says the cookie applies also to subdomain
          // hostOnly key can do the trick
          cookies[i].domain = cookies[i].domain.charAt(0) == "." ? cookies[i].domain.substring(1) : cookies[i].domain;
          cookiesArray.push(cookies[i]);
        }
      }
      generateCookiesList(cookiesArray);
      //generateCookies(cookiesArray);
    });
  }
};

//document.addEventListener("DOMContentLoaded" , cookiesTab.init.bind(cookiesTab), false);

var activeHostNameContId = "";
var finalCookiesArray = new Array();
var searchLastVal = "";

function tabCookiesLoad() {
    //cookiesActionsBinding();
    //checkHostsPermission(true);
}

function cookiesActionsBinding() {
    $("#cookies_tab .cb-enable").click(function(){
        cookiesSwitchCheckboxChange(this, true, true);
    });
    $("#cookies_tab .cb-disable").click(function(){
        cookiesSwitchCheckboxChange(this, false, true);
    });
    $("#searchCookies").keyup(function(){
    	if((searchLastVal == "")&&($("#searchCookies").val()=="")) {
    		return;	
    	}
    	searchLastVal = $("#searchCookies").val();
    	getCookies();
    });
    
    var searchCookies = document.getElementById("searchCookies")
    searchCookies.addEventListener("search", function(e) {
    	$("#searchCookies").trigger('keyup')
    }, false);
    
    $("#removeAllCookies").click(function(){
        cookieRemove("", "all");
    });
}

function cookiesUpdateSettings(settingName, onOff) {
	var settings = localStorage.getItem("settings");
	var settingsJson = JSON.parse(settings);
	
	switch(settingName)
	{
		case "allowHostPermissions":
				if(onOff) {hostPermissionCookies(true);}
				else {hostPermissionCookies(false);	}
		break;
		case "activeTabCookies":
			if(onOff) {	settingsJson.activeTabCookies = true; localStorage.setItem("settings", JSON.stringify(settingsJson)); checkHostsPermission(true);}
			else { settingsJson.activeTabCookies = false; localStorage.setItem("settings", JSON.stringify(settingsJson)); }
		break;
    }
}


function hostPermissionCookies(allow) {
	var settings = localStorage.getItem("settings");
	var settingsJson = JSON.parse(settings);
	
	if(allow) {
		chrome.permissions.request({
			origins: ['http://*/*', 'https://*/*']
		}, function(granted) {
			// The callback argument will be true if the user granted the permissions.
			if (granted) {
				checkActiveTabCookies();
				$("#searchCookies").prop('disabled', false);
				$("#removeAllCookies").prop('disabled', false);
				getCookies();
				
				return true;
			} else {
				return false;
			}
		});
	}
	else {
		chrome.permissions.remove({
			origins: ['http://*/*', 'https://*/*']
		}, function(removed) {
			if (removed) {
				var myElement = $("#activeTabCookies .cb-disable");
				$("#cookiesContainer").html("");
				$("#searchCookies").prop('disabled', true);
				$("#removeAllCookies").prop('disabled', true);
				cookiesSwitchCheckboxChange(myElement, false, false);
				return true;
			} else {
				return false;
	  		}
		});
	}
}

function checkHostsPermission(load) {
	chrome.permissions.contains({
		origins: ['http://*/*', 'https://*/*']
	}, function(result) {
		if (result) {
			var myElement = $("#allowHostPermissions .cb-enable");
			cookiesSwitchCheckboxChange(myElement, true, false);
			checkActiveTabCookies();
			$("#searchCookies").prop('disabled', false);
			$("#removeAllCookies").prop('disabled', false);
			if(load) {
				getCookies();
			}
			else {
				if($("#cookiesContainer").html()=="") {
					getCookies();
				}
				
			}
			return true;
		} else {
			$("#searchCookies").prop('disabled', true);
			$("#removeAllCookies").prop('disabled', true);
			var myElement = $("#activeTabCookies .cb-disable");
			cookiesSwitchCheckboxChange(myElement, false, false);
			
			var myElement = $("#allowHostPermissions .cb-disable");
			cookiesSwitchCheckboxChange(myElement, false, false);
			return false;
		}
	});
}

function checkActiveTabCookies() {
	var settings = localStorage.getItem("settings");
	if(settings == null) {
		var settingsJson = {};
		localStorage.setItem("settings", JSON.stringify(settingsJson));
	}
	else {
		var settingsJson = JSON.parse(settings);
		if(settingsJson.activeTabCookies) {
			var myElement = $("#activeTabCookies .cb-enable");
			cookiesSwitchCheckboxChange(myElement, true, false);
			chrome.tabs.query({active:true},function(tab){
				var currentUrl = tab[0].url.toString();
				var pattern=/(.+:\/\/)?([^\/]+)(\/.*)*/i;
				var hostName=pattern.exec(currentUrl)[2];
				hostName = hostName.slice(0, 4) == "www."?hostName.substr(4):hostName;
				searchLastVal = hostName;
				$("#searchCookies").val(hostName);
			});
			
		}
		else {
			var myElement = $("#activeTabCookies .cb-disable");
			cookiesSwitchCheckboxChange(myElement, false, false);
		}
		
	}
}

function getCookies() {
	$("#cookiesContainer").html("");
	
	var cookiesFiltered = new Array();
	chrome.cookies.getAll({}, function(cookies){
		for (var i in cookies) {
			var patt= new RegExp($("#searchCookies").val());
			if(patt.test(cookies[i].domain)) {
				cookies[i].domain = cookies[i].domain.charAt(0)=="." ? cookies[i].domain.substring(1):cookies[i].domain;
				cookiesFiltered.push(cookies[i]);
			}
		}
		finalCookiesArray = cookiesFiltered;
       	$("#cookiesContainer").html("");
       	generateCookies(cookiesFiltered);
    });
}

function generateCookies(cookies) {
	cookies.sort(sort_by('domain', true, function(a){return a.toUpperCase()}));
	$("#cookiesContainer").css("height", "270px");
	$("#cookiesContainer").css("overflow", "auto");
	
	var lastDomainName = "";
	var firstDomainId = 0;
	var cookieCounter = 1;
	
	for (var i=0; i < cookies.length; i++) {
		if(lastDomainName != cookies[i].domain) {
			if(lastDomainName!="") {
				$("#cookieHostRowContainer_"+(firstDomainId)+" .cookieHostRowCounter").html(cookieCounter+" "+chrome.i18n.getMessage("cookiesCounterName"));
				cookieCounter=1;
			}
			firstDomainId = i;
			var cookieHostRow = "<div id='cookieHostRowContainer_"+i+"'><div class='cookieHostRow'><div class='cookieHostRowName'>"+cookies[i].domain+"</div><div class='cookieHostRowCounter'></div><div id='cookieHostRowRemove_"+i+"' class='cookieHostRowRemove'>x</div></div></div>";
			$("#cookiesContainer").append(cookieHostRow);
			var cookieNameRow = "<div id='cookieNameRow_"+i+"' class='cookieNameRow' title='"+generateCookieTitleDetails(cookies[i])+"'><div class='cookieNameRowName'>"+cookies[i].name+"</div></div>";
			$("#cookieHostRowContainer_"+i).append(cookieNameRow);
			
			$("#cookieHostRowContainer_"+i+"").click(function(){
        		cookieHostRowClicked(this);
    		});
    		
    		$("#cookieHostRowRemove_"+i).click(function(){
    			cookieRemove(this, "host");
    		});
		}
		else {
			cookieCounter++;
			var cookieNameRow = "<div id='cookieNameRow_"+i+"' class='cookieNameRow' title='"+generateCookieTitleDetails(cookies[i])+"'><div class='cookieNameRowName'>"+cookies[i].name+"</div></div>";
			$("#cookieHostRowContainer_"+firstDomainId).append(cookieNameRow);
		}
		
		var cookieNameRowValue = "<div class='cookieNameRowValue'>"+cookies[i].value+"</div>";
		var cookieNameRowRemove = "<div id='cookieNameRowRemove_"+i+"' class='cookieNameRowRemove'>x</div>"; 
		$("#cookieNameRow_"+i).append(cookieNameRowValue);
		$("#cookieNameRow_"+i).append(cookieNameRowRemove);
		
		$("#cookieNameRowRemove_"+i).click(function(){
    		cookieRemove(this, "name");
    	});
		
		lastDomainName = cookies[i].domain;	
	};
	$("#cookieHostRowContainer_"+(firstDomainId)+" .cookieHostRowCounter").html(cookieCounter+" "+chrome.i18n.getMessage("cookiesCounterName"));
}


function cookieHostRowClicked(elem) {
	if(activeHostNameContId != "") {
		$("#"+activeHostNameContId+" .cookieNameRow").hide();
		$("#"+activeHostNameContId+" .cookieHostRow").removeClass("cookieHostRowActive");
	}
	
	
	activeHostNameContId = elem.id;
	$("#"+elem.id+" .cookieNameRow").show();
	
	$("#"+elem.id+" .cookieHostRow").addClass("cookieHostRowActive");
	
}

function cookieRemove(elem, type) {
	if(type == "host") {
		var hostRowId = getCookieIdFromElement(elem.id);
		var cookieNameRow = $("#cookieHostRowContainer_"+hostRowId+" .cookieNameRow");
		for (var i=0; i < cookieNameRow.length; i++) {
			var nameRowId = getCookieIdFromElement($(cookieNameRow[i])[0].id);
			var cookie = finalCookiesArray[nameRowId];
			var url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path; 
			chrome.cookies.remove({"url": url, "name": cookie.name}); 
		};
		$("#cookieHostRowContainer_"+hostRowId).remove();
	}
	else if(type == "name") {
		var nameRowId = getCookieIdFromElement(elem.id);
		var cookie = finalCookiesArray[nameRowId];
		var url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path; 
		var hostContainerElement = $(elem).parent().parent();
		var cookieCounterElement = hostContainerElement.children(":first").children().eq(1);
		var cookieCounter = cookieCounterElement.html().slice(0, cookieCounterElement.html().indexOf(" "));
		chrome.cookies.remove({"url": url, "name": cookie.name}); 
		if(cookieCounter==1){
			hostContainerElement.remove();
		}
		else {
			cookieCounterElement.html(cookieCounter-1+" "+chrome.i18n.getMessage("cookiesCounterName"));
			$("#cookieNameRow_"+nameRowId).remove();
		}
	}
	else if(type == "all") {
		chrome.cookies.getAll({}, function(cookies){
			for (var i in cookies) {
				var patt= new RegExp($("#searchCookies").val());
				if(patt.test(cookies[i].domain)) {
					var url = "http" + (cookies[i].secure ? "s" : "") + "://" + cookies[i].domain + cookies[i].path; 
  					chrome.cookies.remove({"url": url, "name": cookies[i].name}); 
				}
			}
			$("#cookiesContainer").html("");
    	});
	}
}

function getCookieIdFromElement(elementId) {
	var removeElemId = elementId;
	var sliceStart = removeElemId.indexOf("_")+1;
	var sliceEnd = removeElemId.length;
	return removeElemId.slice(sliceStart, sliceEnd);
}

function generateCookieTitleDetails(cookie) {
	var titleMessage = "name: "+cookie.name;
	titleMessage += "\nvalue: "+cookie.value;
	titleMessage += "\npath: "+cookie.path;
	titleMessage += "\nExpires: "+new Date(cookie.expirationDate*1000);
	
	return titleMessage;
	
}

var sort_by = function(field, reverse, primer){
   var key = function (x) {return primer ? primer(x[field]) : x[field]};
   return function (a,b) {
       var A = key(a), B = key(b);
       return ((A < B) ? -1 :
               (A > B) ? +1 : 0) * [-1,1][+!!reverse];                  
   }
}
