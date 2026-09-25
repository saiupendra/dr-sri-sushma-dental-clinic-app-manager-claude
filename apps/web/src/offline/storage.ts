import { createStore } from "idb-keyval";

// Separate IndexedDB databases (idb-keyval keeps one object store per store it
// creates, so two logical stores need two databases rather than one shared db).
export const queryCacheStore = createStore("clinic-app-query-cache", "keyval");
export const outboxDbStore = createStore("clinic-app-outbox", "keyval");
