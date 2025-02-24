import React, { useState } from 'react';
import initialDeck from './initialDeck'; 

export default function Table() {
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
    };

    const handleCall = (callValue) => {
        setCall(callValue);
        setBoardVisible(true);
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

        setPlayers({
            ...players,
            [currentTurn]: newHand,
            board: newBoard
        });

        setSelectedHandCard(null);
        setSelectedTableCards([]);
        setMoveCount(moveCount + 1);
        setCurrentTurn(nextPlayer(currentTurn));

        if (moveCount === 3) {
            setShowDRCButton(true);
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

        if (moveCount === 3) {
            setShowDRCButton(true);
        }
    };

    const performPickup = () => {
        const newBoard = players.board.filter(card => !selectedTableCards.includes(card) && !card.includes(`Stack of ${getCardValue(formatCardName(selectedHandCard))}`));
        const newHand = players[currentTurn].filter(card => card !== selectedHandCard);

        // Check if the board is cleared
        const boardCleared = newBoard.length === 0;

        // Update points based on which team cleared the board
        if (boardCleared) {
            if (['plyr1', 'plyr3'].includes(currentTurn)) {
                if (team1SeepCount < 2) {
                    setTeam1Points(prevPoints => prevPoints + 50);
                    setTeam1SeepCount(prevCount => prevCount + 1);
                } else {
                    setTeam1Points(prevPoints => prevPoints - 50);
                    setTeam1SeepCount(prevCount => prevCount - 1);
                }
            } else if (['plyr2', 'plyr4'].includes(currentTurn)) {
                if (team2SeepCount < 2) {
                    setTeam2Points(prevPoints => prevPoints + 50);
                    setTeam2SeepCount(prevCount => prevCount + 1);
                } else {
                    setTeam2Points(prevPoints => prevPoints - 50);
                    setTeam2SeepCount(prevCount => prevCount - 1);
                }
            }
        }

        setCollectedCards(prevState => ({
            ...prevState,
            [currentTurn]: [...prevState[currentTurn], selectedHandCard, ...selectedTableCards]
        }));

        setPlayers({
            ...players,
            [currentTurn]: newHand,
            board: newBoard
        });

        setSelectedHandCard(null);
        setSelectedTableCards([]);
        setMoveCount(moveCount + 1);
        setCurrentTurn(nextPlayer(currentTurn));

        if (moveCount === 3) {
            setShowDRCButton(true);
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

        setPlayers({
            ...players,
            [currentTurn]: newHand,
            board: newBoard
        });

        setSelectedHandCard(null);
        setMoveCount(moveCount + 1);
        setCurrentTurn(nextPlayer(currentTurn));

        if (moveCount === 3) {
            setShowDRCButton(true);
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
            console.log(`Expecting image path: ${imagePath}`);

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


    return (
        <div className='playTable'>
            <div className="pointsSection">
                <h4>Team 1 (Player 1 & 3) Points: {team1Points + calculatePoints([...collectedCards.plyr1, ...collectedCards.plyr3])}</h4>
                <h4>Team 2 (Player 2 & 4) Points: {team2Points + calculatePoints([...collectedCards.plyr2, ...collectedCards.plyr4])}</h4>
            </div>
            <div className='playerArea' id='board'>
                <h3>Board</h3>
                <div className="cardDivBoard">
                    {boardVisible ? renderBoardCards() : <div>Cards Hidden</div>}
                </div>
            </div>
            <div className='playerArea' id='plyr1'>
                <h3>Player 1</h3>
                <div className="cardDivPlay">
                    {currentTurn === 'plyr1' ? renderHandCards() : players.plyr1.map((card, cardIndex) => (
                        <div className='handCard'  key={cardIndex}><img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /></div>
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
                <h3>Player 2</h3>
                <div className="cardDivPlay">
                    {currentTurn === 'plyr2' ? renderHandCards() : players.plyr2.map((card, cardIndex) => (
                        <div  className='handCard' key={cardIndex}><img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /></div>
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
                <h3>Player 3</h3>
                <div className="cardDivPlay">
                    {currentTurn === 'plyr3' ? renderHandCards() : players.plyr3.map((card, cardIndex) => (
                        <div  className='handCard' key={cardIndex}><img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /></div>
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
                <h3>Player 4</h3>
                <div className="cardDivPlay">
                    {currentTurn === 'plyr4' ? renderHandCards() : players.plyr4.map((card, cardIndex) => (
                        <div className='handCard' key={cardIndex}><img src={`/cards/${formatCardName(card)}.svg`} alt={card} className="cardImage" /></div>
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
            {dealVisible && <button onClick={dealCards}>Deal</button>}
            {showDRCButton && <button onClick={dealRemainingCards}>DRC Button</button>}
            {moveCount === 1 && currentTurn === 'plyr1' && !call && (
                <div>
                    <h4>Player 1, make your call:</h4>
                    {checkValidCalls().map(num => (
                        <button key={num} onClick={() => handleCall(num)}>
                            Call {num}
                        </button>
                    ))}
                </div>
            )}
            {call && (
                <div>
                    <h4>{`Player ${currentTurn.slice(-1)}, choose your action:`}</h4>
                    <p>Select a card from your hand, then select cards from the table to pick up.</p>
                    <button onClick={handlePickup}>Confirm Pickup</button>
                    <button onClick={confirmStack}>Confirm Stack</button>
                    <button onClick={handleThrowAway}>Throw Away</button>
                </div>
            )}
        </div>
    );
}
