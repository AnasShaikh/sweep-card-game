import React, { useState, useEffect } from 'react';
import {
    getStackValue,
    getStackTotalPoints,
    getStackCardCount,
    isLooseStack,
    canAddToStack,
    formatCardName,
    getCardValue,
    calculatePoints,
    checkValidCalls,
    getStackCreator,
    isTeammate     
} from './tableLogic';
import TimerDisplay from './components/TimerDisplay';

// Helper function to get display name for players (handles both human players and bots)
const getPlayerDisplayName = (playerPosition, playerNames) => {
    const playerData = playerNames[playerPosition];
    if (!playerData) return 'Unknown';
    
    // Handle bot players (object format)
    if (typeof playerData === 'object' && playerData.name) {
        return playerData.name;
    }
    
    // Handle human players (string format)
    return playerData;
};

const getCreatorDisplayName = (stackString, currentPosition, playerNames) => {
    const creator = getStackCreator(stackString);
    if (!creator) return '';
    
    if (creator === currentPosition) {
        return 'You';
    } else if (isTeammate(creator, currentPosition)) {
        return `${getPlayerDisplayName(creator, playerNames)} (Teammate)`;
    } else {
        return `${getPlayerDisplayName(creator, playerNames)} (Opponent)`;
    }
};

export default function TableUI({
    // Game State
    players,
    botMoveNotification,
    currentTurn,
    position,
    playerNames,
    boardVisible,
    call,
    moveCount,
    isMyTurn,
    dealVisible,
    showDRCButton,
    
    // Selection State
    selectedHandCard,
    selectedTableCards,
    selectedStackToAddTo,
    selectedHandValue,
    
    // Collected Cards & Scores
    collectedCards,
    team1Points,
    team2Points,
    team1SeepCount,
    team2SeepCount,
    
    // Timer State
    timeLeft,
    isTimerActive,
    timerPlayerId,
    
    // Event Handlers
    onHandCardSelection,
    onTableCardSelection,
    onExistingStackSelection,
    onDealCards,
    onDealRemainingCards,
    onCall,
    onPickup,
    onConfirmStack,
    onConfirmAddToStack,
    onThrowAway,
    onClearSelections
}) {
    
    // State to track if we're on mobile
    const [isMobile, setIsMobile] = useState(false);
    
    // Local notification state for testing
    const [localNotification, setLocalNotification] = useState(null);
    
    // Check screen size on mount and resize
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth <= 600);
        };
        
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);
    
    // Test notification on component mount
    useEffect(() => {
        console.log('TABLEUI COMPONENT MOUNTED');
        setLocalNotification('TableUI Test! 🎮');
        setTimeout(() => setLocalNotification(null), 4000);
    }, []);
    
    const renderBoardCards = () => {
        console.log('Board cards:', players.board);
        console.log('NOTIFICATION TEST - botMoveNotification:', botMoveNotification);
        console.log('NOTIFICATION TEST - localNotification:', localNotification);
        return players.board.map((card, cardIndex) => {
            if (card.startsWith('Stack of')) {
                const stackValue = getStackValue(card);
                const isSelectedForAddTo = selectedStackToAddTo === card;
                const isSelectedAsTableCard = selectedTableCards.includes(card);
                const canAdd = canAddToStack(card, currentTurn, players);
                
                // Extract all cards from stack string
                const cardParts = card.split(': ')[1] ? card.split(': ')[1].split(' + ') : [];
                
                return (
                    <div 
                        key={cardIndex} 
                        className={`stackCard ${isSelectedForAddTo ? 'selected-for-add' : ''} ${isSelectedAsTableCard ? 'selected' : ''} ${canAdd ? 'can-add' : 'cannot-add'}`}
                        onClick={() => {
                            console.log('STACK CLICKED:', card, 'isMyTurn:', isMyTurn);
                            if (!isMyTurn) return;
                            
                            // If already selected for adding to, toggle off
                            if (isSelectedForAddTo) {
                                onExistingStackSelection(null);
                                return;
                            }
                            
                            // If already selected as table card, toggle off
                            if (isSelectedAsTableCard) {
                                onTableCardSelection(card);
                                return;
                            }
                            
                            // Determine selection mode - prioritize selecting for adding over pickup
                            if (selectedStackToAddTo) {
                                // Already have a stack selected for adding to, so select this as table card
                                console.log('PATH: Adding to pickup (already have stack)');
                                onTableCardSelection(card);
                            } else {
                                // Always select stack for adding first (shows "Add to Stack" button)
                                console.log('PATH: Selecting stack for adding');
                                onExistingStackSelection(card);
                            }
                        }}
                    >
                        {cardParts.map((part, index) => {
                            const imagePath = `/cards/${formatCardName(part)}.svg`;
                            return (
                                <div key={index} className="stackedCard">
                                    <img src={imagePath} alt={part} className="cardImage" />
                                </div>
                            );
                        })}
                        <div className="stackLabel">
                            Stack of {stackValue} (by {getCreatorDisplayName(card, position, playerNames)})
                            {isLooseStack(card) ? ' - Loose' : ' - Tight'}
                        </div>
                    </div>
                );
            } else {
                const imagePath = `/cards/${formatCardName(card)}.svg`;
                return (
                    <div 
                        key={cardIndex} 
                        className={`tableCard ${selectedTableCards.includes(card) ? 'selected' : ''}`}
                        onClick={() => onTableCardSelection(card)}
                    >
                        <img src={imagePath} alt={card} className="cardImage" />
                    </div>
                );
            }
        });
    };

    const renderHandCards = () => {
        return players[currentTurn].map((card, cardIndex) => {
            const imagePath = `/cards/${formatCardName(card)}.svg`;

            return (
                <div 
                    key={cardIndex} 
                    className={`handCard ${selectedHandCard === card ? 'selected' : ''}`}
                    onClick={() => onHandCardSelection(card)}
                >
                    <img src={imagePath} alt={card} className="cardImage" />
                </div>
            );
        });
    };

    const renderPlayerArea = (playerId) => {
        const isCurrentPlayer = currentTurn === playerId && isMyTurn;
        const isMyPlayer = position === playerId;
        return (
            <div className={`playerArea ${isCurrentPlayer ? 'current-player' : ''} ${isMyPlayer ? 'my-player' : ''}`} id={playerId} key={playerId}>
                <h3>
                    {getPlayerDisplayName(playerId, playerNames)} 
                    {currentTurn === playerId ? ' (Current Turn)' : ''}
                    {isMobile && position === playerId ? ' (You)' : ''}
                </h3>
                <div className="cardDivPlay">
                    {currentTurn === playerId && isMyTurn ? renderHandCards() : players[playerId].map((card, cardIndex) => {
                        const playerData = playerNames[playerId];
                        const isBot = typeof playerData === 'object' && playerData.isBot;
                        const isMyPlayer = position === playerId;
                        
                        return (
                            <div className='handCard' key={cardIndex}>
                                {isMyPlayer ? 
                                    <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /> : 
                                    <img src="/cards/card_back.svg" alt="Card Back" className="cardImage" />
                                }
                            </div>
                        );
                    })}
                </div>
                <div className="collectedCards">
                    <h4>{isMobile ? 'Collected:' : 'Collected Cards:'}</h4>
                    <div className="cardDiv">
                        {(collectedCards?.[playerId] || []).map((card, cardIndex) => (
                            <div key={cardIndex} className="collectedCard">
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // Mobile layout wrapper
    const renderMobileLayout = () => {
        // Find your player area to always show
        const myPlayerArea = renderPlayerArea(position);
        const otherPlayers = ['plyr1', 'plyr2', 'plyr3', 'plyr4']
            .filter(id => id !== position)
            .map(id => renderPlayerArea(id));
        
        return (
            <div className='playTable'>
                {/* Move Notification */}
                {(botMoveNotification || localNotification) && (
                    <div style={{
                        position: 'fixed',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#ff0000',
                        color: 'white',
                        padding: '15px 30px',
                        zIndex: 99999,
                        fontSize: '18px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        border: '3px solid yellow',
                        borderRadius: '8px',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                        minWidth: '300px'
                    }}>
                        🎮 {botMoveNotification || localNotification} 🎮
                    </div>
                )}
                
                {/* Points Section */}
                <div className="pointsSection">
                    <div className="team-score">
                        <span className="team-label">Team 1</span>
                        <span className="team-members">{getPlayerDisplayName('plyr1', playerNames)} & {getPlayerDisplayName('plyr3', playerNames)}</span>
                        <div className="points-and-seeps">
                            <span className="team-points">{(team1Points || 0) + calculatePoints(collectedCards?.plyr1 || []) + calculatePoints(collectedCards?.plyr3 || [])}</span>
                            <div className="seep-indicators">
                                {Array.from({ length: team1SeepCount || 0 }, (_, i) => (
                                    <div key={i} className="seep-dot" title={`Seep ${i + 1}`}></div>
                                ))}
                                {team1SeepCount === 0 && <span className="seep-text">0 Seeps</span>}
                            </div>
                        </div>
                    </div>
                    <div className="team-score">
                        <span className="team-label">Team 2</span>
                        <span className="team-members">{getPlayerDisplayName('plyr2', playerNames)} & {getPlayerDisplayName('plyr4', playerNames)}</span>
                        <div className="points-and-seeps">
                            <span className="team-points">{(team2Points || 0) + calculatePoints(collectedCards?.plyr2 || []) + calculatePoints(collectedCards?.plyr4 || [])}</span>
                            <div className="seep-indicators">
                                {Array.from({ length: team2SeepCount || 0 }, (_, i) => (
                                    <div key={i} className="seep-dot" title={`Seep ${i + 1}`}></div>
                                ))}
                                {team2SeepCount === 0 && <span className="seep-text">0 Seeps</span>}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Timer Display */}
                <TimerDisplay 
                    timeLeft={timeLeft}
                    isActive={isTimerActive}
                    playerId={timerPlayerId}
                    playerNames={playerNames}
                    currentPosition={position}
                />
                
                
                {/* Board - Large and prominent */}
                <div className='playerArea' id='board'>
                    <div className="cardDivBoard">
                        {boardVisible ? renderBoardCards() : <div>Cards Hidden</div>}
                    </div>
                </div>
                
                {/* Your cards - Always visible */}
                {myPlayerArea}
                
                {/* Other Players - Compact grid, no card backs */}
                <div className="players-mobile-grid">
                    {otherPlayers}
                </div>
                
                {/* Controls */}
                {renderControls()}
            </div>
        );
    };

    // Desktop layout with proper seating arrangement
    const renderDesktopLayout = () => {
        return (
            <div className='playTable'>
                {/* Move Notification */}
                {(botMoveNotification || localNotification) && (
                    <div style={{
                        position: 'fixed',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#ff0000',
                        color: 'white',
                        padding: '15px 30px',
                        zIndex: 99999,
                        fontSize: '18px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        border: '3px solid yellow',
                        borderRadius: '8px',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                        minWidth: '300px'
                    }}>
                        🎮 {botMoveNotification || localNotification} 🎮
                    </div>
                )}
                
                <div className="pointsSection">
                    <div className="team-score">
                        <span className="team-label">Team 1</span>
                        <span className="team-members">{getPlayerDisplayName('plyr1', playerNames)} & {getPlayerDisplayName('plyr3', playerNames)}</span>
                        <div className="points-and-seeps">
                            <span className="team-points">{(team1Points || 0) + calculatePoints(collectedCards?.plyr1 || []) + calculatePoints(collectedCards?.plyr3 || [])}</span>
                            <div className="seep-indicators">
                                {Array.from({ length: team1SeepCount || 0 }, (_, i) => (
                                    <div key={i} className="seep-dot" title={`Seep ${i + 1}`}></div>
                                ))}
                                {team1SeepCount === 0 && <span className="seep-text">0 Seeps</span>}
                            </div>
                        </div>
                    </div>
                    <div className="team-score">
                        <span className="team-label">Team 2</span>
                        <span className="team-members">{getPlayerDisplayName('plyr2', playerNames)} & {getPlayerDisplayName('plyr4', playerNames)}</span>
                        <div className="points-and-seeps">
                            <span className="team-points">{(team2Points || 0) + calculatePoints(collectedCards?.plyr2 || []) + calculatePoints(collectedCards?.plyr4 || [])}</span>
                            <div className="seep-indicators">
                                {Array.from({ length: team2SeepCount || 0 }, (_, i) => (
                                    <div key={i} className="seep-dot" title={`Seep ${i + 1}`}></div>
                                ))}
                                {team2SeepCount === 0 && <span className="seep-text">0 Seeps</span>}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Timer Display */}
                <TimerDisplay 
                    timeLeft={timeLeft}
                    isActive={isTimerActive}
                    playerId={timerPlayerId}
                    playerNames={playerNames}
                    currentPosition={position}
                />
                
                
                {/* Player 1 - Left side, top */}
                <div id="plyr1">
                    {renderPlayerArea('plyr1')}
                </div>
                
                {/* Player 4 - Right side, top */}
                <div id="plyr4">
                    {renderPlayerArea('plyr4')}
                </div>
                
                {/* Board - Center */}
                <div className='playerArea' id='board'>
                    <div className="cardDivBoard">
                        {boardVisible ? renderBoardCards() : <div>Cards Hidden</div>}
                    </div>
                </div>
                
                {/* Player 2 - Left side, bottom */}
                <div id="plyr2">
                    {renderPlayerArea('plyr2')}
                </div>
                
                {/* Player 3 - Right side, bottom */}
                <div id="plyr3">
                    {renderPlayerArea('plyr3')}
                </div>
                
                {renderControls()}
            </div>
        );
    };

    const renderControls = () => {
        return (
            <div className="controls">
                {/* Deal Remaining Cards Button */}
                {isMyTurn && showDRCButton && (
                    <button onClick={onDealRemainingCards}>
                        {isMobile ? 'Deal Cards' : 'Deal Remaining Cards'}
                    </button>
                )}
                
                {/* Call Phase */}
                {isMyTurn && moveCount === 1 && currentTurn === 'plyr2' && !call && (
                    <div>
                        <h4>{isMobile ? 'Your call:' : `${getPlayerDisplayName('plyr2', playerNames)}, make your call:`}</h4>
                        {checkValidCalls(players.plyr2).map(num => (
                            <button key={num} onClick={() => onCall(num)}>
                                Call {num}
                            </button>
                        ))}
                    </div>
                )}
                
                {/* Game Actions Phase */}
                {isMyTurn && (call || moveCount > 1) && (
                    <div>
                        {!isMobile && <h4>{`${getPlayerDisplayName(currentTurn, playerNames)}, choose your action:`}</h4>}
                        
                        {/* Show selection info */}
                        {selectedHandCard && (
                            <p>
                                {isMobile ? `Hand: ${selectedHandCard}` : `Selected hand card: ${selectedHandCard}`} 
                                {!isMobile && ` (Value: ${selectedHandValue})`}
                            </p>
                        )}
                        
                        {selectedStackToAddTo && (
                            <p>
                                {isMobile ? 
                                    `${isLooseStack(selectedStackToAddTo) ? 'Modifying' : 'Adding to'}: ${selectedStackToAddTo.split(':')[0]}` :
                                    `${isLooseStack(selectedStackToAddTo) ? 'Modifying' : 'Adding to'}: ${selectedStackToAddTo.split(':')[0]} 
                                    Current: ${getStackTotalPoints(selectedStackToAddTo)} pts, ${getStackCardCount(selectedStackToAddTo)} cards
                                    After adding: Hand(${selectedHandValue}) + Table(${selectedTableCards.reduce((sum, card) => {
                                        if (card.startsWith("Stack of")) return sum + getStackValue(card);
                                        return sum + getCardValue(formatCardName(card));
                                    }, 0)}) = ${selectedHandValue + selectedTableCards.reduce((sum, card) => {
                                        if (card.startsWith("Stack of")) return sum + getStackValue(card);
                                        return sum + getCardValue(formatCardName(card));
                                    }, 0)} total pts`
                                }
                            </p>
                        )}
                        
                        {selectedTableCards.length > 0 && !selectedStackToAddTo && (
                            <p>{isMobile ? `Table: ${selectedTableCards.length} cards` : `Selected table cards: ${selectedTableCards.length} cards`}</p>
                        )}
                        
                        {!isMobile && (
                            <p>
                                {selectedStackToAddTo ? 
                                    'Select one card from your hand and table cards that together sum to the stack value, then click "Add to Stack"' :
                                    'Select one card from your hand, then select cards from the table or an existing stack.'
                                }
                            </p>
                        )}
                        
                        <div className="action-buttons">
                            <button onClick={onPickup}>
                                {isMobile ? 'Pickup' : 'Confirm Pickup'}
                            </button>
                            <button onClick={onConfirmStack}>
                                {isMobile ? 'New Stack' : 'Create New Stack'}
                            </button>
                            {selectedStackToAddTo && (
                                <button onClick={onConfirmAddToStack}>
                                    {isMobile ? 'Add to Stack' : 'Add to Stack'}
                                </button>
                            )}
                            {console.log('selectedStackToAddTo:', selectedStackToAddTo)}
                            <button onClick={onThrowAway}>
                                {isMobile ? 'Throw' : 'Throw Away'}
                            </button>
                        </div>
                        
                        {/* Clear selections button */}
                        {!isMobile && (
                            <button 
                                onClick={onClearSelections}
                                className="clear-btn"
                            >
                                Clear Selections
                            </button>
                        )}
                    </div>
                )}
                
                {/* Waiting message */}
                {!isMyTurn && (
                    <div className="waiting-message">
                        <p>
                            {isMobile ? 
                                `Waiting for ${getPlayerDisplayName(currentTurn, playerNames)}...` :
                                `Waiting for ${getPlayerDisplayName(currentTurn, playerNames)}'s move...`
                            }
                        </p>
                    </div>
                )}
            </div>
        );
    };

    // Return the appropriate layout based on screen size
    return isMobile ? renderMobileLayout() : renderDesktopLayout();
}