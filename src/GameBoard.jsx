// GameBoard.jsx - UI components for board and card rendering

import React from 'react';
import { 
    formatCardName, 
    getStackValue, 
    getStackTotalPoints, 
    getStackCardCount, 
    getStackCards,
    isLooseStack, 
    canAddToStack 
} from './gameLogic.js';

export const BoardArea = ({ 
    gameState, 
    selectedTableCards, 
    selectedStackToAddTo, 
    onTableCardSelection, 
    onStackSelection,
    isMyTurn,
    position 
}) => {
    const renderBoardCards = () => {
        return gameState.players.board.map((card, cardIndex) => {
            if (card.startsWith('Stack of')) {
                const stackValue = getStackValue(card);
                const isSelectedForAddTo = selectedStackToAddTo === card;
                const isSelectedAsTableCard = selectedTableCards.includes(card);
                const canAdd = canAddToStack(card, position);
                
                const cardParts = getStackCards(card);
                
                return (
                    <div 
                        key={cardIndex} 
                        className={`stackCard ${isSelectedForAddTo ? 'selected-for-add' : ''} ${isSelectedAsTableCard ? 'selected' : ''} ${canAdd ? 'can-add' : 'cannot-add'}`}
                        onClick={() => {
                            if (!isMyTurn) return;
                            
                            if (isSelectedForAddTo) {
                                onStackSelection(null);
                                return;
                            }
                            
                            if (isSelectedAsTableCard) {
                                onTableCardSelection(card);
                                return;
                            }
                            
                            if (selectedStackToAddTo) {
                                onTableCardSelection(card);
                            } else if (selectedTableCards.length > 0) {
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
                            Stack of {stackValue} 
                            {isLooseStack(card) ? ' (Loose)' : ' (Tight)'}
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
                                                onStackSelection(card);
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

    return (
        <div className='playerArea' id='board'>
            <h3>Board</h3>
            <div className="cardDivBoard">
                {gameState.boardVisible ? renderBoardCards() : <div>Cards Hidden</div>}
            </div>
        </div>
    );
};

export const PlayerArea = ({ 
    playerKey,
    playerName,
    gameState,
    currentTurn,
    position,
    selectedHandCard,
    onHandCardSelection,
    isMyTurn 
}) => {
    const renderHandCards = () => {
        return gameState.players[playerKey].map((card, cardIndex) => {
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

    const renderPlayerCards = () => {
        if (currentTurn === playerKey && isMyTurn) {
            return renderHandCards();
        } else {
            return gameState.players[playerKey].map((card, cardIndex) => (
                <div className='handCard' key={cardIndex}>
                    {position === playerKey ? 
                        <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /> : 
                        <img src="/cards/card_back.svg" alt="Card Back" className="cardImage" />
                    }
                </div>
            ));
        }
    };

    return (
        <div className='playerArea' id={playerKey}>
            <h3>{playerName} {currentTurn === playerKey ? '(Current Turn)' : ''}</h3>
            <div className="cardDivPlay">
                {renderPlayerCards()}
            </div>
            <div className="collectedCards">
                <h4>Collected Cards:</h4>
                <div className="cardDiv">
                    {gameState.collectedCards[playerKey].map((card, cardIndex) => (
                        <div key={cardIndex} className="collectedCard">
                            <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const PointsDisplay = ({ gameState, playerNames, calculatePoints }) => {
    return (
        <div className="pointsSection">
            <h4>
                Team 1 ({playerNames.plyr1} & {playerNames.plyr3}) Points: {
                    gameState.team1Points + calculatePoints([
                        ...gameState.collectedCards.plyr1, 
                        ...gameState.collectedCards.plyr3
                    ])
                }
            </h4>
            <h4>
                Team 2 ({playerNames.plyr2} & {playerNames.plyr4}) Points: {
                    gameState.team2Points + calculatePoints([
                        ...gameState.collectedCards.plyr2, 
                        ...gameState.collectedCards.plyr4
                    ])
                }
            </h4>
        </div>
    );
};

export const ActionButtons = ({ 
    isMyTurn,
    position,
    gameState,
    selectedHandCard,
    selectedTableCards,
    selectedStackToAddTo,
    onPickup,
    onCreateStack,
    onAddToStack,
    onThrowAway,
    onClearSelections 
}) => {
    if (!isMyTurn || !gameState.call) return null;

    const selectedHandValue = selectedHandCard ? 
        require('./gameLogic.js').getCardFaceValue(require('./gameLogic.js').formatCardName(selectedHandCard)) : 0;

    return (
        <div>
            <h4>{`Choose your action:`}</h4>
            
            {/* Show selection info */}
            {selectedHandCard && (
                <p>Selected hand card: {selectedHandCard} (Value: {selectedHandValue})</p>
            )}
            
            {selectedStackToAddTo && (
                <p>
                    {require('./gameLogic.js').isLooseStack(selectedStackToAddTo) ? 'Modifying' : 'Adding to'}: {selectedStackToAddTo.split(':')[0]} 
                    <br/>Current: {require('./gameLogic.js').getStackTotalPoints(selectedStackToAddTo)} pts, {require('./gameLogic.js').getStackCardCount(selectedStackToAddTo)} cards
                    <br/>After adding: Hand({selectedHandValue}) + Table({selectedTableCards.reduce((sum, card) => {
                        if (card.startsWith("Stack of")) return sum + require('./gameLogic.js').getStackValue(card);
                        return sum + require('./gameLogic.js').getCardFaceValue(require('./gameLogic.js').formatCardName(card));
                    }, 0)}) = {selectedHandValue + selectedTableCards.reduce((sum, card) => {
                        if (card.startsWith("Stack of")) return sum + require('./gameLogic.js').getStackValue(card);
                        return sum + require('./gameLogic.js').getCardFaceValue(require('./gameLogic.js').formatCardName(card));
                    }, 0)} total pts
                </p>
            )}
            
            {selectedTableCards.length > 0 && !selectedStackToAddTo && (
                <p>Selected table cards: {selectedTableCards.length} cards</p>
            )}
            
            <p>
                {selectedStackToAddTo ? 
                    'Select one card from your hand and table cards that together sum to the stack value, then click "Add to Stack"' :
                    'Select one card from your hand, then select cards from the table or an existing stack.'
                }
            </p>
            
            <div>
                {!selectedStackToAddTo && <button onClick={onPickup}>Confirm Pickup</button>}
                {!selectedStackToAddTo && <button onClick={onCreateStack}>Create New Stack</button>}
                {selectedStackToAddTo && <button onClick={onAddToStack}>Add to Stack</button>}
                <button onClick={onThrowAway}>Throw Away</button>
            </div>
            
            <button onClick={onClearSelections} className="clear-btn">
                Clear Selections
            </button>
        </div>
    );
};

export const CallButtons = ({ gameState, playerNames, onCall, checkValidCalls }) => {
    if (gameState.moveCount !== 1 || gameState.currentTurn !== 'plyr2' || gameState.call) {
        return null;
    }

    const validCalls = checkValidCalls(gameState.players.plyr2);

    return (
        <div>
            <h4>{playerNames.plyr2}, make your call:</h4>
            {validCalls.map(num => (
                <button key={num} onClick={() => onCall(num)}>
                    Call {num}
                </button>
            ))}
        </div>
    );
};

export const WaitingMessage = ({ isMyTurn, currentPlayerName }) => {
    if (isMyTurn) return null;

    return (
        <div className="waiting-message">
            <p>Waiting for {currentPlayerName}'s move...</p>
        </div>
    );
};