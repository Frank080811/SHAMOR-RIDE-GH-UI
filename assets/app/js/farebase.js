import { getMessaging, getToken } from "firebase/messaging";

const messaging = getMessaging(firebaseApp);

getToken(messaging).then(token => {
  fetch("/users/save-push-token", {
    method: "POST",
    body: JSON.stringify({ token })
  });
});


getToken(messaging, { vapidKey: VAPID_KEY }).then(token => {
  fetch("http://localhost:8000/users/push-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("access_token")}`
    },
    body: JSON.stringify({ token })
  });
});

