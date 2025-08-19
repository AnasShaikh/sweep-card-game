import React from 'react';

const TimerDisplay = ({ timeLeft, isActive, playerId, playerNames, currentPosition }) => {
    if (!isActive || !playerId) {
        return null; // Don't show timer if not active
    }

    // Get player display name
    const getPlayerDisplayName = (position) => {
        const playerData = playerNames[position];
        if (typeof playerData === 'object' && playerData.name) {
            return playerData.name; // Bot name
        } else if (typeof playerData === 'string') {
            return playerData; // Human player name
        }
        return 'Player';
    };

    const playerName = playerId === currentPosition ? 'Your' : `${getPlayerDisplayName(playerId)}'s`;
    
    // Color coding based on time remaining
    const getTimerColor = () => {
        if (timeLeft > 20) return '#28a745'; // Green
        if (timeLeft > 10) return '#ffc107'; // Yellow  
        return '#dc3545'; // Red
    };

    const getTimerClass = () => {
        if (timeLeft <= 5) return 'timer-critical';
        if (timeLeft <= 10) return 'timer-warning';
        return 'timer-normal';
    };

    // Calculate progress percentage
    const progressPercentage = (timeLeft / 30) * 100;

    return (
        <div className={`timer-container ${getTimerClass()}`}>
            <div className="timer-info">
                <span className="timer-label">{playerName} turn</span>
                <span className="timer-value">{timeLeft}s</span>
            </div>
            
            {/* Progress bar */}
            <div className="timer-progress-bar">
                <div 
                    className="timer-progress-fill"
                    style={{ 
                        width: `${progressPercentage}%`,
                        backgroundColor: getTimerColor(),
                        transition: 'width 1s linear'
                    }}
                />
            </div>
            
            
        </div>
    );
};

export default TimerDisplay;