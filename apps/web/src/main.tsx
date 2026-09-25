import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { App } from "./App.js";
import { AuthProvider } from "./auth/AuthContext.js";
import { SyncProvider } from "./offline/SyncContext.js";
import { queryPersister } from "./offline/persister.js";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      // NetworkError is handled explicitly by the offline outbox; retrying it
      // automatically here would just repeat the same failure.
      networkMode: "always",
    },
    mutations: {
      networkMode: "always",
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        // Auth state is deliberately never persisted: a stale cached "signed
        // out" snapshot from before a login would otherwise flash true on
        // the very next reload (rehydration is synchronous, the real /me
        // recheck isn't) and bounce an already-signed-in user through
        // /login. Re-checking it fresh on every load is cheap and correct;
        // every other query (patients, appointments, ...) still persists
        // for offline access.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.queryKey[0] !== "auth",
        },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <SyncProvider>
            <App />
          </SyncProvider>
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);
