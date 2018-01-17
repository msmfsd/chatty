// client/src/app.js
import React from 'react';
import { ApolloProvider } from 'react-apollo';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { composeWithDevTools } from 'redux-devtools-extension';
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import AppWithNavigationState, { navigationReducer } from './navigation';

const networkInterface = createNetworkInterface({ uri: 'http://localhost:8080/graphql' });
const client = new ApolloClient({
  networkInterface,
});
const store = createStore(
  combineReducers({
    apollo: client.reducer(),
    nav: navigationReducer,
  }),
  {}, // initial state
  composeWithDevTools(applyMiddleware(client.middleware())),
);

const App = () => (
  <ApolloProvider store={store} client={client}>
    <AppWithNavigationState />
  </ApolloProvider>
);

export default App;
