import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import torchIcon from '../src/torchIcon.png';
import pivotIcon from '../src/pivotIcon.png';
import './main.css';

const Main = () => {
  const [email, setEmail] = useState('');
  const [showToolTip, setShowToolTip] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in via localStorage
    const savedUser = localStorage.getItem('timioUser');
    if (savedUser) {
      const { email } = JSON.parse(savedUser);
      setEmail(email);
    }

    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/');
      } else {
        setEmail(user.email);
        localStorage.setItem('timioUser', JSON.stringify({
          email: user.email,
          uid: user.uid
        }));
        chrome.storage.local.set({
          authToken: user.accessToken,
          isLoggedIn: true,
          userId: user.uid
        });
      }
    });

    // Show tooltip on first visit
    const hasSeenTooltip = localStorage.getItem('hasSeenTooltip');
    if (!hasSeenTooltip) {
      setShowToolTip(true);
      localStorage.setItem('hasSeenTooltip', 'true');
    }

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('timioUser');
      chrome.storage.local.remove(['authToken', 'isLoggedIn', 'userId']);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="extension-container">
      {/* Header */}
      <header className="extension-header">
        <h1 className="logo">TIMIO</h1>
        <div className="header-buttons">
          <button 
            className="profile-button"
            onClick={() => navigate('/profile')}
          >
            <svg viewBox="0 0 24 24" className="profile-icon">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </button>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="extension-main">
        {/* Welcome Section */}
        <div className="instruction-box">
          <div className="instruction-header">
            <h3 className="get-started-header">Get Started</h3>
            <div className="step-indicator">Step 1</div>
          </div>
          <p className="instruction-text">
            While reading any news article, click the
          </p>

          <div className="plus-sign-container">
            <svg className="plus-sign" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>

          <p className="instruction-text">
            button at the bottom right corner to access TIMIO's analysis tools
          </p>

          {showToolTip && (
            <div className="instruction-tooltip">
              <span>👋 First time? Try clicking the + icon on any news website!</span>
              <button className="tooltip-close" onClick={() => setShowToolTip(false)}>×</button>
            </div>
          )}
        </div>

        {/* Tools Section */}
        <section className="tools-section">
          <h3 className="tools-title">Available Tools</h3>
          
          {/* Torch Tool */}
          <div className="tool-card">
            <div className="tool-icon-wrapper">
              <img src={torchIcon} alt="Torch" className="tool-icon" />
            </div>
            <div className="tool-info">
              <h4>Torch</h4>
              <p>Analyze article bias and credibility</p>
              <ul className="tool-features">
                <li>Detect political bias</li>
                <li>Identify emotional language</li>
                <li>Check source reliability</li>
              </ul>
            </div>
          </div>

          {/* Pivot Tool */}
          <div className="tool-card">
            <div className="tool-icon-wrapper">
              <img src={pivotIcon} alt="Pivot" className="tool-icon" />
            </div>
            <div className="tool-info">
              <h4>Pivot</h4>
              <p>Find alternative viewpoints</p>
              <ul className="tool-features">
                <li>Discover different perspectives</li>
                <li>Compare news coverage</li>
                <li>See related articles</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer Navigation */}
        <footer className="extension-footer">
          <nav className="footer-nav">
            <button onClick={() => navigate('/profile')}>My Profile</button>
            <span className="nav-separator">•</span>
            <button onClick={() => navigate('/subscription')}>Subscription</button>
          </nav>
        </footer>
      </main>
    </div>
  );
};

export default Main;