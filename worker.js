"use strict";
//var _better = {version: 1, logging: true, appKey:"b0c6e44714304c5697b13ff4dcd7c3ad", host: "http://localhost:8081", baseURL: "http://localhost:8081"};

var _better = {
    version: 2,
    logging: true,
    // appKey: "b0c6e44714304c5697b13ff4dcd7c3ad",
    host: "https://bebetter.in"
};

self.addEventListener('install', function(evt) {
    //Automatically take over the previous worker.
    evt.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(evt) {
    if (_better.logging) console.log("Activated Roost ServiceWorker version: " + _better.version);
});

//Handle the push received event.
self.addEventListener('push', function(evt) {
    if (_better.logging) console.log("push listener", evt);
    evt.waitUntil(self.registration.pushManager.getSubscription().then(function(subscription) {
        var regID = null;
        if ('subscriptionId' in subscription) {
            regID = subscription.subscriptionId;
        } else {
            //in Chrome 44+ and other SW browsers, reg ID is part of endpoint, send the whole thing and let the server figure it out.
            regID = subscription.endpoint;
        }
        var mergedEndpoint = endpointWorkaround(subscription);
        var endpointSections = mergedEndpoint.split('/');
        var did = endpointSections[endpointSections.length - 1]
        console.log("hitting URL: "+_better.host + "/notification/"+did);
        return fetch(_better.host + "/notification/"+did).then(function(response) {
            return response.json().then(function(json) {
                if (_better.logging) console.log(json);
                var promises = [];
                // for (var i = 0; i < json.notifications.length; i++) {
                    var note = json;
                    if (_better.logging) console.log("Showing notification: " + note.body);
                    // var url = "/roost.html?noteID=" + note.roost_note_id + "&sendID=" + note.roost_send_id + "&body=" + encodeURIComponent(note.body);
                    var url = note.icon_url + '?notificationURL=' + encodeURIComponent(note.redirect_url);
                    promises.push(showNotification(note._id, note.title, note.body, note.icon_url));
                // }
                return Promise.all(promises);
            }).catch(function(err) {
                console.log('something weird happened');
                console.log(err);
            });
        });
    }));
});

self.addEventListener('notificationclick', function(evt) {
    if (_better.logging) console.log("notificationclick listener", evt);
    evt.waitUntil(handleNotificationClick(evt));
});

function parseQueryString(queryString) {
    var qd = {};
    queryString.split("&").forEach(function (item) {
        var parts = item.split("=");
        var k = parts[0];
        var v = decodeURIComponent(parts[1]);
        (k in qd) ? qd[k].push(v) : qd[k] = [v, ]
    });
    return qd;
}

//Utility function to handle the click
function handleNotificationClick(evt) {
    if (_better.logging) console.log("Notification clicked: ", evt.notification);
    evt.notification.close();
    var iconURL = evt.notification.icon;
    if (iconURL.indexOf("?") > -1) {
        var queryString = iconURL.split("?")[1];
        var query = parseQueryString(queryString);
        console.log(query);
        if (query.url && query.url.length == 1) {
            if (_better.logging) console.log("Opening URL: " + query.url[0]);
            return clients.openWindow(query.url[0]);
        }
    }
    console.log("Failed to redirect to notification for iconURL: " + iconURL);
}

//Utility function to actually show the notification.
function showNotification(noteID, title, body, icon) {
    var options = {
        body: body,
        tag: "pushflix",
        icon: icon
    };
    return self.registration.showNotification(title, options);
}

function endpointWorkaround(pushSubscription) {
  // Make sure we only mess with GCM
  if (pushSubscription.endpoint.indexOf('https://android.googleapis.com/gcm/send') !== 0) {
    return pushSubscription.endpoint;
  }

  var mergedEndpoint = pushSubscription.endpoint;
  // Chrome 42 + 43 will not have the subscriptionId attached
  // to the endpoint.
  if (pushSubscription.subscriptionId &&
    pushSubscription.endpoint.indexOf(pushSubscription.subscriptionId) === -1) {
    // Handle version 42 where you have separate subId and Endpoint
    mergedEndpoint = pushSubscription.endpoint + '/' +
      pushSubscription.subscriptionId;
  }
  return mergedEndpoint;
}
