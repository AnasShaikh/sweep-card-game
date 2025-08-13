import React from 'react';
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

// Get position class for player layout
const getPositionClass = (playerKey, myPosition) => {
    const positions = {
        plyr1: 'top',
        plyr2: 'right', 
        plyr3: 'bottom',
        plyr4: 'left'
    };
    
    // Rotate positions based on current player's perspective
    const myPositionIndex = Object.keys(positions).indexOf(myPosition);
    const playerIndex = Object.keys(positions).indexOf(playerKey);
    const relativeIndex = (playerIndex - myPositionIndex + 4) % 4;
    
    return Object.values(positions)[relativeIndex];
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
    onDealRemainingCards,
    onCall,
    onPickup,
    onConfirmStack,
    onConfirmAddToStack,
    onThrowAway,
    onClearSelections
}) {
    
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
                            
                            if (isSelectedForAddTo) {
                                onExistingStackSelection(null);
                                return;
                            }
                            
                            if (isSelectedAsTableCard) {
                                onTableCardSelection(card);
                                return;
                            }
                            
                            if (selectedStackToAddTo) {
                                onTableCardSelection(card);
                            } else if (selectedTableCards.length > 0 || selectedHandCard) {
                                onTableCardSelection(card);
                            } else {
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
                            <div>Total: {getStackTotalPoints(card)} pts, {getStackCardCount(card)} cards</div>
                            {isMyTurn && (
                                <div className="stack-actions">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTableCardSelection(card);
                                        }}
                                        className="stack-action-btn"
                                    >
                                        Select for Pickup
                                    </button>
                                    {canAdd && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onExistingStackSelection(card);
                                            }}
                                            className="stack-action-btn"
                                        >
                                            {isLooseStack(card) ? 'Modify Stack' : 'Add to Stack'}
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

    const renderHandCards = (playerKey) => {
        return players[playerKey].map((card, cardIndex) => {
            const imagePath = `/cards/${formatCardName(card)}.svg`;
            const isCurrentPlayerTurn = currentTurn === playerKey;
            const isMyCards = position === playerKey;
            const canSelect = isCurrentPlayerTurn && isMyTurn && isMyCards;

            return (
                <div 
                    key={cardIndex} 
                    className={`handCard ${selectedHandCard === card ? 'selected' : ''} ${canSelect ? 'selectable' : ''}`}
                    onClick={() => canSelect ? onHandCardSelection(card) : null}
                >
                    {isMyCards ? 
                        <img src={imagePath} alt={card} className="cardImage" /> : 
                        <img src="/cards/card_back.svg" alt="Card Back" className="cardImage" />
                    }
                </div>
            );
        });
    };

    const renderPlayerArea = (playerKey) => {
        const positionClass = getPositionClass(playerKey, position);
        const isCurrentPlayer = currentTurn === playerKey;
        const isMe = position === playerKey;
        
        return (
            <div key={playerKey} className={`playerArea ${positionClass} ${isCurrentPlayer ? 'current-turn' : ''} ${isMe ? 'my-area' : ''}`}>
                <div className="player-header">
                    <h3>
                        {playerNames[playerKey]} 
                        {isMe && ' (You)'}
                        {isCurrentPlayer && ' - Current Turn'}
                    </h3>
                </div>
                
                <div className="player-cards">
                    <div className="hand-cards">
                        {renderHandCards(playerKey)}
                    </div>
                </div>
                
                <div className="collected-section">
                    <h4>Collected ({collectedCards[playerKey].length} cards)</h4>
                    <div className="collected-cards-grid">
                        {collectedCards[playerKey].slice(0, 8).map((card, cardIndex) => (
                            <div key={cardIndex} className="collected-card-mini">
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="mini-card" />
                            </div>
                        ))}
                        {collectedCards[playerKey].length > 8 && (
                            <div className="more-cards">+{collectedCards[playerKey].length - 8}</div>
                        )}
                    </div>
                </div>
                
                {/* Action buttons for current player */}
                {isCurrentPlayer && isMyTurn && (
                    <div className="player-actions">
                        {moveCount === 1 && currentTurn === 'plyr2' && !call && (
                            <div className="call-section">
                                <h4>Make your call:</h4>
                                <div className="call-buttons">
                                    {checkValidCalls(players.plyr2).map(num => (
                                        <button key={num} onClick={() => onCall(num)} className="call-btn">
                                            Call {num}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {call && (
                            <div className="action-section">
                                <div className="selection-info">
                                    {selectedHandCard && (
                                        <p>Hand: {selectedHandCard} (Value: {selectedHandValue})</p>
                                    )}
                                    {selectedTableCards.length > 0 && (
                                        <p>Table: {selectedTableCards.length} cards selected</p>
                                    )}
                                    {selectedStackToAddTo && (
                                        <p>{isLooseStack(selectedStackToAddTo) ? 'Modifying' : 'Adding to'} stack</p>
                                    )}
                                </div>
                                
                                <div className="action-buttons">
                                    {!selectedStackToAddTo && <button onClick={onPickup} className="action-btn pickup">Pickup</button>}
                                    {!selectedStackToAddTo && <button onClick={onConfirmStack} className="action-btn stack">Create Stack</button>}
                                    {selectedStackToAddTo && <button onClick={onConfirmAddToStack} className="action-btn add-stack">Add to Stack</button>}
                                    <button onClick={onThrowAway} className="action-btn throw">Throw Away</button>
                                    <button onClick={onClearSelections} className="action-btn clear">Clear</button>
                                </div>
                            </div>
                        )}
                        
                        {showDRCButton && (
                            <button onClick={onDealRemainingCards} className="deal-btn">
                                Deal Remaining Cards
                            </button>
                        )}
                    </div>
                )}
                
                {!isMyTurn && isCurrentPlayer && (
                    <div className="waiting-turn">
                        <p>Waiting for {playerNames[currentTurn]}'s move...</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="game-table">
            {/* Score Header */}
            <div className="score-header">
                <div className="team-score">
                    <h3>Team 1: {playerNames.plyr1} & {playerNames.plyr3}</h3>
                    <div className="points">{team1Points + calculatePoints([...collectedCards.plyr1, ...collectedCards.plyr3])} points</div>
                </div>
                <div className="game-info">
                    <div>Move: {moveCount}</div>
                </div>
                <div className="team-score">
                    <h3>Team 2: {playerNames.plyr2} & {playerNames.plyr4}</h3>
                    <div className="points">{team2Points + calculatePoints([...collectedCards.plyr2, ...collectedCards.plyr4])} points</div>
                </div>
            </div>
            
            {/* Game Table Layout */}
            <div className="table-layout">
                {/* Render players in their positions */}
                {['plyr1', 'plyr2', 'plyr3', 'plyr4'].map(playerKey => renderPlayerArea(playerKey))}
                
                {/* Central Board */}
                <div className="board-area">
                    <h3>Board</h3>
                    <div className="board-cards">
                        {boardVisible ? renderBoardCards() : <div className="cards-hidden">Cards Hidden</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}