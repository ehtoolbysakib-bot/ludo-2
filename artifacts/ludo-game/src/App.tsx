import React from 'react';
import { Switch, Route, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { AuthProvider, useAuth } from './lib/auth';
import SplashAndHome from './pages/SplashAndHome';
import Home from './pages/Home';
import SignInPage from './pages/SignInPage';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Admin from './pages/Admin';
import CreateRoom from './pages/CreateRoom';
import JoinRoom from './pages/JoinRoom';
import RoomLobby from './pages/RoomLobby';
import GameBoard from './pages/GameBoard';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: any }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
  if (!isSignedIn) return <Redirect to="/home" />;
  return <Component />;
}

function Routes() {
  return (
    <Switch>
      {/* Splash always shows first, then redirects to /home */}
      <Route path="/" component={SplashAndHome} />

      {/* Home is public — username check happens inside when needed */}
      <Route path="/home" component={Home} />

      {/* Sign-in just for direct access */}
      <Route path="/sign-in" component={SignInPage} />

      {/* Game routes — require username */}
      <Route path="/room/create">
        {() => <ProtectedRoute component={CreateRoom} />}
      </Route>
      <Route path="/room/join">
        {() => <ProtectedRoute component={JoinRoom} />}
      </Route>
      <Route path="/room/:code">
        {() => <ProtectedRoute component={RoomLobby} />}
      </Route>
      <Route path="/game/:code">
        {() => <ProtectedRoute component={GameBoard} />}
      </Route>

      <Route path="/leaderboard">
        {() => <ProtectedRoute component={Leaderboard} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={Admin} />}
      </Route>

      <Route>
        <div className="flex min-h-screen items-center justify-center text-white">404 - Not Found</div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes />
          <Toaster theme="dark" position="top-center" />
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
