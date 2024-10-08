import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';
import RoomLobby from './RoomLobby';
import VotingScreen from './VotingScreen';
import ResultsScreen from './ResultsScreen';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room/:roomCode" element={<RoomLobby />} />
        <Route path="/voting/:roomCode" element={<VotingScreen />} />
        <Route path="/results/:roomCode" element={<ResultsScreen />} />
      </Routes>
    </Router>
  );
};

export default App;
