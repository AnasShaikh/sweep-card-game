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
    getStackCreator,    // ADD THIS
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

    return (
        <div className='playTable'>
            <div className="pointsSection">
                <h4>Team 1 ({playerNames.plyr1} & {playerNames.plyr3}) Points: {team1Points + calculatePoints([...collectedCards.plyr1, ...collectedCards.plyr3])}</h4>
                <h4>Team 2 ({playerNames.plyr2} & {playerNames.plyr4}) Points: {team2Points + calculatePoints([...collectedCards.plyr2, ...collectedCards.plyr4])}</h4>
            </div>
            
            <div className='playerArea' id='board'>
                <h3>Board</h3>
                <div className="cardDivBoard">
                    {boardVisible ? renderBoardCards() : <div>Cards Hidden</div>}
                </div>
            </div>
            
            <div className='playerArea' id='plyr1'>
                <h3>{playerNames.plyr1} {currentTurn === 'plyr1' ? '(Current Turn)' : ''}</h3>
                <div className="cardDivPlay">
                    {currentTurn === 'plyr1' && isMyTurn ? renderHandCards() : players.plyr1.map((card, cardIndex) => (
                        <div className='handCard' key={cardIndex}>
                            {position === 'plyr1' ? 
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /> : 
                                <img src="/cards/card_back.svg" alt="Card Back" className="cardImage" />
                            }
                        </div>
                    ))}
                </div>
                <div className="collectedCards">
                    <h4>Collected Cards:</h4>
                    <div className="cardDiv">
                        {collectedCards.plyr1.map((card, cardIndex) => (
                            <div key={cardIndex} className="collectedCard">
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className='playerArea' id='plyr2'>
                <h3>{playerNames.plyr2} {currentTurn === 'plyr2' ? '(Current Turn)' : ''}</h3>
                <div className="cardDivPlay">
                    {currentTurn === 'plyr2' && isMyTurn ? renderHandCards() : players.plyr2.map((card, cardIndex) => (
                        <div className='handCard' key={cardIndex}>
                            {position === 'plyr2' ? 
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /> : 
                                <img src="/cards/card_back.svg" alt="Card Back" className="cardImage" />
                            }
                        </div>
                    ))}
                </div>
                <div className="collectedCards">
                    <h4>Collected Cards:</h4>
                    <div className="cardDiv">
                        {collectedCards.plyr2.map((card, cardIndex) => (
                            <div key={cardIndex} className="collectedCard">
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className='playerArea' id='plyr3'>
                <h3>{playerNames.plyr3} {currentTurn === 'plyr3' ? '(Current Turn)' : ''}</h3>
                <div className="cardDivPlay">
                    {currentTurn === 'plyr3' && isMyTurn ? renderHandCards() : players.plyr3.map((card, cardIndex) => (
                        <div className='handCard' key={cardIndex}>
                            {position === 'plyr3' ? 
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /> : 
                                <img src="/cards/card_back.svg" alt="Card Back" className="cardImage" />
                            }
                        </div>
                    ))}
                </div>
                <div className="collectedCards">
                    <h4>Collected Cards:</h4>
                    <div className="cardDiv">
                        {collectedCards.plyr3.map((card, cardIndex) => (
                            <div key={cardIndex} className="collectedCard">
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className='playerArea' id='plyr4'>
                <h3>{playerNames.plyr4} {currentTurn === 'plyr4' ? '(Current Turn)' : ''}</h3>
                <div className="cardDivPlay">
                    {currentTurn === 'plyr4' && isMyTurn ? renderHandCards() : players.plyr4.map((card, cardIndex) => (
                        <div className='handCard' key={cardIndex}>
                            {position === 'plyr4' ? 
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /> : 
                                <img src="/cards/card_back.svg" alt="Card Back" className="cardImage" />
                            }
                        </div>
                    ))}
                </div>
                <div className="collectedCards">
                    <h4>Collected Cards:</h4>
                    <div className="cardDiv">
                        {collectedCards.plyr4.map((card, cardIndex) => (
                            <div key={cardIndex} className="collectedCard">
                                <img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="controls">
                {position === 'plyr1' && dealVisible && <button onClick={onDealCards}>Deal Cards</button>}
                {isMyTurn && showDRCButton && <button onClick={onDealRemainingCards}>Deal Remaining Cards</button>}
                
                {isMyTurn && moveCount === 1 && currentTurn === 'plyr2' && !call && (
                    <div>
                        <h4>{playerNames.plyr2}, make your call:</h4>
                        {checkValidCalls(players.plyr2).map(num => (
                            <button key={num} onClick={() => onCall(num)}>
                                Call {num}
                            </button>
                        ))}
                    </div>
                )}
                
                {isMyTurn && call && (
                    <div>
                        <h4>{`${playerNames[currentTurn]}, choose your action:`}</h4>
                        
                        {/* Show selection info */}
                        {selectedHandCard && (
                            <p>Selected hand card: {selectedHandCard} (Value: {selectedHandValue})</p>
                        )}
                        
                        {selectedStackToAddTo && (
                            <p>
                                {isLooseStack(selectedStackToAddTo) ? 'Modifying' : 'Adding to'}: {selectedStackToAddTo.split(':')[0]} 
                                <br/>Current: {getStackTotalPoints(selectedStackToAddTo)} pts, {getStackCardCount(selectedStackToAddTo)} cards
                                <br/>After adding: Hand({selectedHandValue}) + Table({selectedTableCards.reduce((sum, card) => {
                                    if (card.startsWith("Stack of")) return sum + getStackValue(card);
                                    return sum + getCardValue(formatCardName(card));
                                }, 0)}) = {selectedHandValue + selectedTableCards.reduce((sum, card) => {
                                    if (card.startsWith("Stack of")) return sum + getStackValue(card);
                                    return sum + getCardValue(formatCardName(card));
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
                            {!selectedStackToAddTo && <button onClick={onConfirmStack}>Create New Stack</button>}
                            {selectedStackToAddTo && <button onClick={onConfirmAddToStack}>Add to Stack</button>}
                            <button onClick={onThrowAway}>Throw Away</button>
                        </div>
                        
                        {/* Clear selections button */}
                        <button 
                            onClick={onClearSelections}
                            className="clear-btn"
                        >
                            Clear Selections
                        </button>
                    </div>
                )}
                
                {!isMyTurn && (
                    <div className="waiting-message">
                        <p>Waiting for {playerNames[currentTurn]}'s move...</p>
                    </div>
                )}
            </div>
        </div>
    );
}