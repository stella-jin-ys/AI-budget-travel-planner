"use client";

import { useState } from "react";
import { SpendwiseLogo } from "./spendwise-logo";

export type AppNavProps = {
  userEmail?: string;
  onRequestAuth?: () => void;
  onSignOut?: () => void;
  onHome?: () => void;
  context?: string;
};

export function AppNav({ userEmail, onRequestAuth, onSignOut, onHome, context }: AppNavProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  return (
    <nav className="app-nav" aria-label="Primary navigation">
      <div className="app-nav__row">
        <button type="button" className="app-nav__brand" aria-label="Budget Trip home" onClick={onHome}>
          <SpendwiseLogo />
        </button>
        <div className="app-nav__actions">
          {userEmail ? (
            <>
              <button
                type="button"
                className="app-nav__avatar"
                aria-label={`Signed in as ${userEmail}. Open account menu`}
                aria-haspopup="menu"
                aria-expanded={isAccountMenuOpen}
                onClick={() => setIsAccountMenuOpen((open) => !open)}
              >
                {userEmail.trim().charAt(0).toUpperCase()}
              </button>
              {isAccountMenuOpen ? (
                <div className="app-nav__account-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onSignOut?.();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <button type="button" className="app-nav__access" onClick={onRequestAuth}>Sign in</button>
          )}
        </div>
      </div>
      {context ? <span className="app-nav__context">{context}</span> : null}
    </nav>
  );
}
