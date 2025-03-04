import React, { useState, useEffect } from 'react';
import initialDeck from './initialDeck'; 

export default function Table({ gameId, user, position, playerNames, socket, onGameAction, initialGameState }) {
    const [deck, setDeck] = useState(initialDeck);
    const [players, setPlayers] = useState({ plyr1: [], plyr2: [], plyr3: [], plyr4: [], board: [] });
    const [currentTurn, setCurrentTurn] = useState('plyr1');
    const [moveCount, setMoveCount] = useState(0);
    const [call, setCall] = useState(null);
    const [boardVisible, setBoardVisible] = useState(false);
    const [selectedHandCard, setSelectedHandCard] = useState(null);
    const [selectedTableCards, setSelectedTableCards] = useState([]);
    const [collectedCards, setCollectedCards] = useState({ plyr1: [], plyr2: [], plyr3: [], plyr4: [] });
    const [dealVisible, setDealVisible] = useState(true);
    const [remainingCardsDealt, setRemainingCardsDealt] = useState(false);
    const [showDRCButton, setShowDRCButton] = useState(false);
    const [team1SeepCount, setTeam1SeepCount] = useState(0);
    const [team2SeepCount, setTeam2SeepCount] = useState(0);
    const [team1Points, setTeam1Points] = useState(0);
    const [team2Points, setTeam2Points] = useState(0);

    // Initialize game state if provided
    useEffect(() => {
        if (initialGameState) {
            setDeck(initialGameState.deck || initialDeck);
            setPlayers(initialGameState.players || { plyr1: [], plyr2: [], plyr3: [], plyr4: [], board: [] });
            setCurrentTurn(initialGameState.currentTurn || 'plyr1');
            setMoveCount(initialGameState.moveCount || 0);
            setCall(initialGameState.call || null);
            setBoardVisible(true);
            setCollectedCards(initialGameState.collectedCards);
            setDealVisible(initialGameState.dealVisible);
            setRemainingCardsDealt(initialGameState.remainingCardsDealt);
            setShowDRCButton(initialGameState.showDRCButton);
            setTeam1SeepCount(initialGameState.team1SeepCount);
            setTeam2SeepCount(initialGameState.team2SeepCount);
            setTeam1Points(initialGameState.team1Points);
            setTeam2Points(initialGameState.team2Points);
        }
    }, [initialGameState]);

    // Listen for game actions from other players
    useEffect(() => {
        if (!socket) return;

        socket.on('gameAction', ({ player, action, data }) => {
            switch (action) {
                case 'dealCards':
                    setPlayers(data.players);
                    setDeck(data.deck);
                    setMoveCount(1);
                    setCurrentTurn('plyr1');
                    setCall(null);
                    setBoardVisible(false);
                    setSelectedHandCard(null);
                    setSelectedTableCards([]);
                    setDealVisible(false);
                    break;

                case 'dealRemainingCards':
                    setPlayers(data.players);
                    setDeck(data.deck);
                    setRemainingCardsDealt(true);
                    setShowDRCButton(false);
                    break;

                case 'makeCall':
                    setCall(data.call);
                    setBoardVisible(true);
                    break;

                case 'pickup':
                case 'throwAway':
                case 'stack':
                    setPlayers(data.players);
                    setCurrentTurn(data.currentTurn);
                    setMoveCount(data.moveCount);
                    setCollectedCards(data.collectedCards);
                    setTeam1Points(data.team1Points);
                    setTeam2Points(data.team2Points);
                    setTeam1SeepCount(data.team1SeepCount);
                    setTeam2SeepCount(data.team2SeepCount);
                    setShowDRCButton(data.showDRCButton);
                    break;

                default:
                    break;
            }
        });

        return () => {
            socket.off('gameAction');
        };
    }, [socket]);

    // Update game state after any significant change
    useEffect(() => {
        if (!onGameAction) return;

        const gameState = {
            deck,
            players,
            currentTurn,
            moveCount,
            call,
            collectedCards,
            dealVisible,
            remainingCardsDealt,
            showDRCButton,
            team1SeepCount,
            team2SeepCount,
            team1Points,
            team2Points
        };

        onGameAction('updateGameState', gameState);
    }, [
        deck, players, currentTurn, moveCount, call, 
        collectedCards, dealVisible, remainingCardsDealt, 
        showDRCButton, team1SeepCount, team2SeepCount, 
        team1Points, team2Points
    ]);

    const shuffleDeck = (deck) => deck.sort(() => Math.random() - 0.5);

    const formatCardName = (card) => {
        let [value, suit] = card.toLowerCase().split(' of ');

        if (value === 'j') value = 'jack';
        if (value === 'q') value = 'queen';
        if (value === 'k') value = 'king';
        if (value === 'a') value = 'ace';

        suit = suit.toLowerCase();
        return `${value}_of_${suit}`;
    };

    const getCardValue = (card) => {
        const value = card.split('_')[0];
        switch (value) {
            case 'ace': return 1;
            case '2': return 2;
            case '3': return 3;
            case '4': return 4;
            case '5': return 5;
            case '6': return 6;
            case '7': return 7;
            case '8': return 8;
            case '9': return 9;
            case '10': return 10;
            case 'jack': return 11;
            case 'queen': return 12;
            case 'king': return 13;
            default: return null;
        }
    };

    const dealCards = () => {
        let shuffledDeck = shuffleDeck([...deck]);
        let newPlayers = {
            plyr1: shuffledDeck.splice(0, 4),
            plyr2: shuffledDeck.splice(0, 4),
            plyr3: shuffledDeck.splice(0, 4),
            plyr4: shuffledDeck.splice(0, 4),
            board: shuffledDeck.splice(0, 4)
        };

        setPlayers(newPlayers);
        setDeck(shuffledDeck);
        setMoveCount(1);
        setCurrentTurn('plyr1');
        setCall(null);
        setBoardVisible(false);
        setSelectedHandCard(null);
        setSelectedTableCards([]);
        setDealVisible(false);

        // Send action to other players
        if (onGameAction) {
            onGameAction('dealCards', {
                players: newPlayers,
                deck: shuffledDeck
            });
        }
    };

    const dealRemainingCards = () => {
        let remainingCards = [...deck];
        let newPlayers = { ...players };
        newPlayers.plyr1.push(...remainingCards.splice(0, 8));
        newPlayers.plyr2.push(...remainingCards.splice(0, 8));
        newPlayers.plyr3.push(...remainingCards.splice(0, 8));
        newPlayers.plyr4.push(...remainingCards.splice(0, 8));

        setPlayers(newPlayers);
        setDeck(remainingCards);
        setRemainingCardsDealt(true);
        setShowDRCButton(false);

        // Send action to other players
        if (onGameAction) {
            onGameAction('dealRemainingCards', {
                players: newPlayers,
                deck: remainingCards
            });
        }
    };

    const handleCall = (callValue) => {
        setCall(callValue);
        setBoardVisible(true);

        // Send action to other players
        if (onGameAction) {
            onGameAction('makeCall', { call: callValue });
        }
    };

    const checkValidCalls = () => {
        const playerHand = players[currentTurn];
        const validCalls = playerHand
            .map(card => getCardValue(formatCardName(card)))
            .filter(value => value >= 9 && value <= 13);

        if (validCalls.length === 0) {
            setDealVisible(true);
        }

        return [...new Set(validCalls)];
    };

    const handleStackSelection = (card) => {
        setSelectedHandCard(card);
    };

    const handleTableCardSelection = (card) => {
        if (selectedTableCards.includes(card)) {
            setSelectedTableCards(selectedTableCards.filter(c => c !== card));
        } else {
            setSelectedTableCards([...selectedTableCards, card]);
        }
    };

    const confirmStack = () => {
        if (!selectedHandCard) {
            alert("Please select a card from your hand.");
            return;
        }

        if (selectedTableCards.length === 0) {
            alert("Please select one or more cards from the table.");
            return;
        }

        const handCardValue = getCardValue(formatCardName(selectedHandCard));
        const tableCardsValue = selectedTableCards.reduce((sum, card) => sum + getCardValue(formatCardName(card)), 0);
        const totalStackValue = handCardValue + tableCardsValue;

        let stackValue = call;
        let isAddingToExistingStack = false;

        if (moveCount > 1) {
            stackValue = parseInt(prompt("Enter the value of the stack (9, 10, 11, 12, 13):"), 10);

            if (![9, 10, 11, 12, 13].includes(stackValue)) {
                alert("Invalid stack value. It must be one of 9, 10, 11, 12, or 13.");
                return;
            }

            const existingStackIndex = players.board.findIndex(card => card.includes(`Stack of ${stackValue}`));
            if (existingStackIndex !== -1) {
                isAddingToExistingStack = true;
            }

            const matchingCardExists = 
                (handCardValue === stackValue && players[currentTurn].filter(card => getCardValue(formatCardName(card)) === stackValue && card !== selectedHandCard).length > 0) ||
                (handCardValue !== stackValue && players[currentTurn].filter(card => getCardValue(formatCardName(card)) === stackValue).length > 0);

            if (!matchingCardExists) {
                alert(`You need to have at least one more ${stackValue} in your hand to proceed.`);
                return;
            }

            if (!isAddingToExistingStack && totalStackValue % stackValue !== 0) {
                alert(`The total value of the stack must be a multiple of ${stackValue}.`);
                return;
            }

        } else {
            if (totalStackValue % call !== 0) {
                alert(`The stack value must be equal to or a multiple of your call (${call}).`);
                return;
            }

            const matchingCardExists = players[currentTurn].some(card => getCardValue(formatCardName(card)) === call && card !== selectedHandCard);
            if (!matchingCardExists) {
                alert(`You need an extra card matching ${selectedHandCard} in your hand to create this stack.`);
                return;
            }
        }

        let newBoard;
        if (isAddingToExistingStack) {
            newBoard = [...players.board];
            const existingStackIndex = newBoard.findIndex(card => card.includes(`Stack of ${stackValue}`));
            newBoard[existingStackIndex] = `${newBoard[existingStackIndex]} + ${selectedHandCard}`;
        } else {
            newBoard = players.board.filter(card => !selectedTableCards.includes(card));
            newBoard.push(`Stack of ${totalStackValue}: ${selectedHandCard} + ${selectedTableCards.join(' + ')}`);
        }

        const newHand = players[currentTurn].filter(card => card !== selectedHandCard);
        const nextPlayerTurn = nextPlayer(currentTurn);
        const nextMoveCount = moveCount + 1;
        const nextShowDRCButton = nextMoveCount === 4;

        const newPlayers = {
            ...players,
            [currentTurn]: newHand,
            board: newBoard
        };

        setPlayers(newPlayers);
        setSelectedHandCard(null);
        setSelectedTableCards([]);
        setMoveCount(nextMoveCount);
        setCurrentTurn(nextPlayerTurn);
        setShowDRCButton(nextShowDRCButton);

        // Send action to other players
        if (onGameAction) {
            onGameAction('stack', {
                players: newPlayers,
                currentTurn: nextPlayerTurn,
                moveCount: nextMoveCount,
                collectedCards,
                team1Points,
                team2Points,
                team1SeepCount,
                team2SeepCount,
                showDRCButton: nextShowDRCButton
            });
        }
    };

    const handlePickup = () => {
        if (!selectedHandCard) {
            alert("Please select a card from your hand to pick up.");
            return;
        }

        const handCardValue = getCardValue(formatCardName(selectedHandCard));
        const tableCardsValue = selectedTableCards.reduce((sum, card) => {
            if (card.startsWith("Stack of")) {
                const stackValue = parseInt(card.split(' ')[2], 10);
                return sum + stackValue;
            }
            return sum + getCardValue(formatCardName(card));
        }, 0);

        if (moveCount === 1) {
            if (handCardValue !== call) {
                alert(`You must use the card that matches your call (${call}) to pick up.`);
                return;
            }

            if (tableCardsValue % handCardValue === 0) {
                performPickup();
            } else {
                alert(`The selected cards' total value is not divisible by your card's value (${handCardValue}).`);
            }
        } else {
            if (handCardValue === tableCardsValue || tableCardsValue % handCardValue === 0) {
                performPickup();
            } else {
                alert("The selected cards do not add up to or are not divisible by the value of the card in your hand.");
            }
        }
    };

    const performPickup = () => {
        const newBoard = players.board.filter(card => !selectedTableCards.includes(card) && !card.includes(`Stack of ${getCardValue(formatCardName(selectedHandCard))}`));
        const newHand = players[currentTurn].filter(card => card !== selectedHandCard);

        // Check if the board is cleared
        const boardCleared = newBoard.length === 0;

        let newTeam1Points = team1Points;
        let newTeam2Points = team2Points;
        let newTeam1SeepCount = team1SeepCount;
        let newTeam2SeepCount = team2SeepCount;

        // Update points based on which team cleared the board
        if (boardCleared) {
            if (['plyr1', 'plyr3'].includes(currentTurn)) {
                if (newTeam1SeepCount < 2) {
                    newTeam1Points += 50;
                    newTeam1SeepCount += 1;
                } else {
                    newTeam1Points -= 50;
                    newTeam1SeepCount -= 1;
                }
            } else if (['plyr2', 'plyr4'].includes(currentTurn)) {
                if (newTeam2SeepCount < 2) {
                    newTeam2Points += 50;
                    newTeam2SeepCount += 1;
                } else {
                    newTeam2Points -= 50;
                    newTeam2SeepCount -= 1;
                }
            }
        }

        const newCollectedCards = {
            ...collectedCards,
            [currentTurn]: [...collectedCards[currentTurn], selectedHandCard, ...selectedTableCards]
        };

        const nextPlayerTurn = nextPlayer(currentTurn);
        const nextMoveCount = moveCount + 1;
        const nextShowDRCButton = nextMoveCount === 4;

        const newPlayers = {
            ...players,
            [currentTurn]: newHand,
            board: newBoard
        };

        setCollectedCards(newCollectedCards);
        setPlayers(newPlayers);
        setSelectedHandCard(null);
        setSelectedTableCards([]);
        setMoveCount(nextMoveCount);
        setCurrentTurn(nextPlayerTurn);
        setTeam1Points(newTeam1Points);
        setTeam2Points(newTeam2Points);
        setTeam1SeepCount(newTeam1SeepCount);
        setTeam2SeepCount(newTeam2SeepCount);
        setShowDRCButton(nextShowDRCButton);

        // Send action to other players
        if (onGameAction) {
            onGameAction('pickup', {
                players: newPlayers,
                currentTurn: nextPlayerTurn,
                moveCount: nextMoveCount,
                collectedCards: newCollectedCards,
                team1Points: newTeam1Points,
                team2Points: newTeam2Points,
                team1SeepCount: newTeam1SeepCount,
                team2SeepCount: newTeam2SeepCount,
                showDRCButton: nextShowDRCButton
            });
        }
    };

    const handleThrowAway = () => {
        if (!selectedHandCard) {
            alert("Please select a card from your hand to throw away.");
            return;
        }

        const handCardValue = getCardValue(formatCardName(selectedHandCard));

        if (moveCount === 1) {
            if (handCardValue !== call) {
                alert(`The card you throw away must match your call (${call}).`);
                return;
            }
        }

        const newBoard = [...players.board, selectedHandCard];
        const newHand = players[currentTurn].filter(card => card !== selectedHandCard);
        const nextPlayerTurn = nextPlayer(currentTurn);
        const nextMoveCount = moveCount + 1;
        const nextShowDRCButton = nextMoveCount === 4;

        const newPlayers = {
            ...players,
            [currentTurn]: newHand,
            board: newBoard
        };

        setPlayers(newPlayers);
        setSelectedHandCard(null);
        setMoveCount(nextMoveCount);
        setCurrentTurn(nextPlayerTurn);
        setShowDRCButton(nextShowDRCButton);

        // Send action to other players
        if (onGameAction) {
            onGameAction('throwAway', {
                players: newPlayers,
                currentTurn: nextPlayerTurn,
                moveCount: nextMoveCount,
                collectedCards,
                team1Points,
                team2Points,
                team1SeepCount,
                team2SeepCount,
                showDRCButton: nextShowDRCButton
            });
        }
    };

    const nextPlayer = (current) => {
        switch (current) {
            case 'plyr1': return 'plyr2';
            case 'plyr2': return 'plyr3';
            case 'plyr3': return 'plyr4';
            case 'plyr4': return 'plyr1';
            default: return 'plyr1';
        }
    };

    const calculatePoints = (collectedCards) => {
        return collectedCards.reduce((total, card) => {
            const value = getCardValue(formatCardName(card));
            const suit = card.split(' ')[2].toLowerCase();

            if (suit === 'spades') {
                return total + value;
            } else if (value === 1) { 
                return total + 1;
            } else if (card.toLowerCase() === '10 of diamonds') {
                return total + 6;
            } else {
                return total;
            }
        }, 0);
    };

    const renderBoardCards = () => {
        return players.board.map((card, cardIndex) => {
            if (card.startsWith('Stack of')) {
                const cardParts = card.split(': ')[1].split(' + ');
                return (
                    <div key={cardIndex} className="stackCard">
                        {cardParts.map((part, index) => {
                            const imagePath = `/cards/${formatCardName(part)}.svg`;
                            return (
                                <div key={index} className="stackedCard">
                                    <img src={imagePath} alt={part} className="cardImage" />
                                </div>
                            );
                        })}
                        <div className="stackLabel">{card.split(':')[0]}</div>
                    </div>
                );
            } else {
                const imagePath = `/cards/${formatCardName(card)}.svg`;
                return (
                    <div 
                        key={cardIndex} 
                        className={`tableCard ${selectedTableCards.includes(card) ? 'selected' : ''}`}
                        onClick={() => handleTableCardSelection(card)}
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
                    onClick={() => handleStackSelection(card)}
                >
                    <img src={imagePath} alt={card} className="cardImage" />
                </div>
            );
        });
    };

    const getTurnMessage = () => {
        if (!isMyTurn) {
          return `Waiting for ${playerNames[currentTurn]}'s move...`;
        } else if (moveCount === 1 && !call) {
          return `${playerNames[position]}, make your call:`;
        } else if (call) {
          return `${playerNames[position]}, choose your action:`;
        } else {
            return '';
        }
      };

    // Check if it's current user's turn
    const isMyTurn = position === currentTurn;

    return (
        <div className='playTable'>
            <div className="pointsSection">
                <h4>Team 1 ({playerNames.plyr1} & {playerNames.plyr3}) Points: {team1Points + calculatePoints([...collectedCards.plyr1, ...collectedCards.plyr3])}</h4>
                <h4>Team 2 ({playerNames.plyr2} & {playerNames.plyr4}) Points: {team2Points + calculatePoints([...collectedCards.plyr2, ...collectedCards.plyr4])}</h4>
                <h4 className={isMyTurn ? "my-turn" : ""}>{getTurnMessage()}</h4>
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
                {position === 'plyr1' && dealVisible && <button onClick={dealCards}>Deal Cards</button>}
                {isMyTurn && showDRCButton && <button onClick={dealRemainingCards}>Deal Remaining Cards</button>}

                {isMyTurn && moveCount === 1 && currentTurn === 'plyr1' && !call && (
                    <div>
                        {checkValidCalls().map(num => (
                            <button key={num} onClick={() => handleCall(num)}>
                                Call {num}
                            </button>
                        ))}
                    </div>
                )}

                {isMyTurn && call && (
                    <div>
                        <p>Select a card from your hand, then select cards from the table.</p>
                        <div>
                            <button onClick={handlePickup}>Confirm Pickup</button>
                            <button onClick={confirmStack}>Confirm Stack</button>
                            <button onClick={handleThrowAway}>Throw Away</button>
                        </div>
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