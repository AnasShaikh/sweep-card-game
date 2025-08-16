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

const getCreatorDisplayName = (stackString, currentPosition, playerNames) => {
    const creator = getStackCreator(stackString);
    if (!creator) return '';
    
    if (creator === currentPosition) {
        return 'You';
    } else if (isTeammate(creator, currentPosition)) {
        return `${playerNames[creator]} (Teammate)`;
    } else {
        return `${playerNames[creator]} (Opponent)`;
    }
};

export default function TableUI({
    // Game State
    players,
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
    
    // Check screen size on mount and resize
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth <= 600);
        };
        
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);
    
    const renderBoardCards = () => {
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
                            
                            // Determine selection mode based on current selections
                            if (selectedStackToAddTo) {
                                // Already have a stack selected for adding to, so select this as table card
                                onTableCardSelection(card);
                            } else if (selectedTableCards.length > 0 || selectedHandCard) {
                                // Have other selections, so this is likely for pickup - select as table card
                                onTableCardSelection(card);
                            } else {
                                // No other selections, could be either pickup or add-to
                                // For now, default to table card selection (pickup mode)
                                // User can use "Add to Stack" button if they want add-to mode
                                onTableCardSelection(card);
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
                            {isMyTurn && (
                                <div className="stack-actions">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTableCardSelection(card);
                                        }}
                                        className="stack-action-btn"
                                    >
                                        {isMobile ? 'Pickup' : 'Select for Pickup'}
                                    </button>
                                    {canAdd && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onExistingStackSelection(card);
                                            }}
                                            className="stack-action-btn"
                                        >
                                            {isMobile ? (isLooseStack(card) ? 'Modify' : 'Add') : (isLooseStack(card) ? 'Modify Stack' : 'Add to Stack')}
                                        </button>
                                    )}
                                </div>
                            )}
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
                    {playerNames[playerId]} 
                    {currentTurn === playerId ? ' (Current Turn)' : ''}
                    {isMobile && position === playerId ? ' (You)' : ''}
                </h3>
                <div className="cardDivPlay">
                    {currentTurn === playerId && isMyTurn ? renderHandCards() : players[playerId].map((card, cardIndex) => (
                        <div className='handCard' key={cardIndex}>
                            {position === playerId ? 
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /> : 
                                <img src="/cards/card_back.svg" alt="Card Back" className="cardImage" />
                            }
                        </div>
                    ))}
                </div>
                <div className="collectedCards">
                    <h4>{isMobile ? 'Collected:' : 'Collected Cards:'}</h4>
                    <div className="cardDiv">
                        {collectedCards[playerId].map((card, cardIndex) => (
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
                {/* Points Section */}
                <div className="pointsSection">
                    <h4>Team 1 ({playerNames.plyr1} & {playerNames.plyr3}): {team1Points + calculatePoints([...collectedCards.plyr1, ...collectedCards.plyr3])}</h4>
                    <h4>Team 2 ({playerNames.plyr2} & {playerNames.plyr4}): {team2Points + calculatePoints([...collectedCards.plyr2, ...collectedCards.plyr4])}</h4>
                </div>
                
                {/* Board - Large and prominent */}
                <div className='playerArea' id='board'>
                    <h3>Board</h3>
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

    // Desktop layout (back to original structure + improvements)
    const renderDesktopLayout = () => {
        return (
            <div className='playTable'>
                <div className="pointsSection">
                    <h4>Team 1 ({playerNames.plyr1} & {playerNames.plyr3}) Points: {team1Points + calculatePoints([...collectedCards.plyr1, ...collectedCards.plyr3])}</h4>
                    <h4>Team 2 ({playerNames.plyr2} & {playerNames.plyr4}) Points: {team2Points + calculatePoints([...collectedCards.plyr2, ...collectedCards.plyr4])}</h4>
                </div>
                
                {renderPlayerArea('plyr1')}
                
                <div className='playerArea' id='board'>
                    <h3>Board</h3>
                    <div className="cardDivBoard">
                        {boardVisible ? renderBoardCards() : <div>Cards Hidden</div>}
                    </div>
                </div>
                
                {renderPlayerArea('plyr2')}
                {renderPlayerArea('plyr3')}
                {renderPlayerArea('plyr4')}
                
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
                        <h4>{isMobile ? 'Your call:' : `${playerNames.plyr2}, make your call:`}</h4>
                        {checkValidCalls(players.plyr2).map(num => (
                            <button key={num} onClick={() => onCall(num)}>
                                Call {num}
                            </button>
                        ))}
                    </div>
                )}
                
                {/* Game Actions Phase */}
                {isMyTurn && call && (
                    <div>
                        {!isMobile && <h4>{`${playerNames[currentTurn]}, choose your action:`}</h4>}
                        
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
                            {!selectedStackToAddTo && (
                                <>
                                    <button onClick={onPickup}>
                                        {isMobile ? 'Pickup' : 'Confirm Pickup'}
                                    </button>
                                    <button onClick={onConfirmStack}>
                                        {isMobile ? 'New Stack' : 'Create New Stack'}
                                    </button>
                                </>
                            )}
                            {selectedStackToAddTo && (
                                <button onClick={onConfirmAddToStack}>
                                    {isMobile ? 'Add to Stack' : 'Add to Stack'}
                                </button>
                            )}
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
                                `Waiting for ${playerNames[currentTurn]}...` :
                                `Waiting for ${playerNames[currentTurn]}'s move...`
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