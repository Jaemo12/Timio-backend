import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import './landingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        navigate('/main');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="landing-container">
      <div className="logo-section">
        <h1>TIMIO</h1>
        <p>News Analysis with AI</p>
      </div>

      <div className="feature-cards">
        <div className="feature-card">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Instant Analysis
          </h3>
          <p>Get AI-powered insights for any news article instantly</p>
        </div>

        <div className="feature-card">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Bias Detection
          </h3>
          <p>Identify potential bias and get balanced perspectives</p>
        </div>
      </div>

      <div className="auth-actions">
        <button 
          onClick={() => navigate('/login')} 
          className="auth-primary-btn"
        >
          Sign In
        </button>
        <button 
          onClick={() => navigate('/signup')} 
          className="auth-secondary-btn"
        >
          Create Account
        </button>
        <p className="auth-info">7-day free trial • No credit card required</p>
      </div>
    </div>
  );
};

export default LandingPage;