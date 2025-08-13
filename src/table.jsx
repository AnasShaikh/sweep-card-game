import React, { useState, useEffect, useRef } from 'react';
import initialDeck from './initialDeck';
import TableUI from './TableUI';
import {
    shuffleDeck,
    nextPlayer,
    checkValidCalls,
    getCardValue,
    formatCardName
} from './tableLogic';
import {
    confirmStack,
    confirmAddToStack,
    handlePickup,
    performPickup,
    handleThrowAway,
    handleEndOfRound
} from './tableActions';

export default function Table({ gameId, user, position, playerNames, socket, onGameAction, initialGameState }) {
    const [deck, setDeck] = useState(initialDeck);
    const [players, setPlayers] = useState({ plyr1: [], plyr2: [], plyr3: [], plyr4: [], board: [] });
    const [currentTurn, setCurrentTurn] = useState('plyr2'); // Start with plyr2 (opposite team)
    const [moveCount, setMoveCount] = useState(0);
    const [call, setCall] = useState(null);
    const [boardVisible, setBoardVisible] = useState(false);
    const [selectedHandCard, setSelectedHandCard] = useState(null); // Single card selection
    const [selectedTableCards, setSelectedTableCards] = useState([]);
    const [selectedStackToAddTo, setSelectedStackToAddTo] = useState(null); // For adding to existing stacks
    const [collectedCards, setCollectedCards] = useState({ plyr1: [], plyr2: [], plyr3: [], plyr4: [] });
    const [dealVisible, setDealVisible] = useState(true);
    const [remainingCardsDealt, setRemainingCardsDealt] = useState(false);
    const [showDRCButton, setShowDRCButton] = useState(false);
    const [team1SeepCount, setTeam1SeepCount] = useState(0);
    const [team2SeepCount, setTeam2SeepCount] = useState(0);
    const [team1Points, setTeam1Points] = useState(0);
    const [team2Points, setTeam2Points] = useState(0);
    const [lastCollector, setLastCollector] = useState(null); // Track who picked up cards last
    
    const gameStateRef = useRef();
    
    // Initialize game state
    useEffect(() => {
        if (initialGameState) {
            setDeck(initialGameState.deck || initialDeck);
            setPlayers(initialGameState.players || { plyr1: [], plyr2: [], plyr3: [], plyr4: [], board: [] });
            setCurrentTurn(initialGameState.currentTurn || 'plyr2');
            setMoveCount(initialGameState.moveCount || 0);
            setCall(initialGameState.call || null);
            setBoardVisible(initialGameState.boardVisible || false);
            setCollectedCards(initialGameState.collectedCards || { plyr1: [], plyr2: [], plyr3: [], plyr4: [] });
            setDealVisible(initialGameState.dealVisible !== false);
            setRemainingCardsDealt(initialGameState.remainingCardsDealt || false);
            setShowDRCButton(initialGameState.showDRCButton || false);
            setTeam1SeepCount(initialGameState.team1SeepCount || 0);
            setTeam2SeepCount(initialGameState.team2SeepCount || 0);
            setTeam1Points(initialGameState.team1Points || 0);
            setTeam2Points(initialGameState.team2Points || 0);
            setLastCollector(initialGameState.lastCollector || null);
        }
    }, [initialGameState]);
    
    // Listen for game actions
    useEffect(() => {
        if (!socket) return;
        
        socket.on('gameAction', ({ player, action, data }) => {
            switch (action) {
                case 'dealCards':
                    setPlayers(data.players);
                    setDeck(data.deck);
                    setMoveCount(1);
                    setCurrentTurn('plyr2'); // First turn goes to plyr2
                    setCall(null);
                    setBoardVisible(false);
                    setSelectedHandCard(null);
                    setSelectedTableCards([]);
                    setSelectedStackToAddTo(null);
                    setDealVisible(false);
                    setLastCollector(null); // Reset last collector for new round
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
                    setPlayers(data.players);
                    setCurrentTurn(data.currentTurn);
                    setMoveCount(data.moveCount);
                    setCollectedCards(data.collectedCards);
                    setTeam1Points(data.team1Points);
                    setTeam2Points(data.team2Points);
                    setTeam1SeepCount(data.team1SeepCount);
                    setTeam2SeepCount(data.team2SeepCount);
                    setShowDRCButton(data.showDRCButton);
                    setLastCollector(data.lastCollector); // Update last collector
                    setSelectedHandCard(null);
                    setSelectedTableCards([]);
                    setSelectedStackToAddTo(null);
                    break;
                    
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
                    if (data.lastCollector !== undefined) {
                        setLastCollector(data.lastCollector);
                    }
                    setSelectedHandCard(null);
                    setSelectedTableCards([]);
                    setSelectedStackToAddTo(null);
                    break;
                    
                default:
                    break;
            }
        });
        
        return () => {
            socket.off('gameAction');
        };
    }, [socket]);
    
    // Check for end of round and assign remaining cards
    const checkEndOfRound = (newPlayers, newCollectedCards, newLastCollector) => {
        // Check if all players' hands are empty
        const allHandsEmpty = ['plyr1', 'plyr2', 'plyr3', 'plyr4'].every(
            player => newPlayers[player].length === 0
        );
        
        if (allHandsEmpty && newPlayers.board.length > 0 && newLastCollector) {
            const endResult = handleEndOfRound(newPlayers, newLastCollector, newCollectedCards);
            if (endResult) {
                return {
                    players: endResult.newPlayers,
                    collectedCards: endResult.newCollectedCards
                };
            }
        }
        
        return null;
    };
    
    // Update game state - FIXED to prevent infinite loop
    useEffect(() => {
        if (!onGameAction) return;
        
        const gameState = {
            deck,
            players,
            currentTurn,
            moveCount,
            call,
            boardVisible,
            collectedCards,
            dealVisible,
            remainingCardsDealt,
            showDRCButton,
            team1SeepCount,
            team2SeepCount,
            team1Points,
            team2Points,
            lastCollector
        };
        
        // Only update if game state actually changed
        if (JSON.stringify(gameState) !== JSON.stringify(gameStateRef.current)) {
            gameStateRef.current = gameState;
            onGameAction('updateGameState', gameState);
        }
    }); // Removed dependencies to prevent infinite loop

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
        setCurrentTurn('plyr2'); // plyr2 starts first
        setCall(null);
        setBoardVisible(false);
        setSelectedHandCard(null);
        setSelectedTableCards([]);
        setSelectedStackToAddTo(null);
        setDealVisible(false);
        setLastCollector(null); // Reset last collector for new round
        
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
        
        if (onGameAction) {
            onGameAction('makeCall', { call: callValue });
        }
    };

    // Single hand card selection
    const handleHandCardSelection = (card) => {
        if (selectedHandCard === card) {
            setSelectedHandCard(null);
        } else {
            setSelectedHandCard(card);
        }
    };

    const handleTableCardSelection = (card) => {
        if (selectedTableCards.includes(card)) {
            setSelectedTableCards(selectedTableCards.filter(c => c !== card));
        } else {
            setSelectedTableCards([...selectedTableCards, card]);
        }
    };

    // Handle existing stack selection
    const handleExistingStackSelection = (stackString) => {
        if (selectedStackToAddTo === stackString) {
            setSelectedStackToAddTo(null);
        } else {
            setSelectedStackToAddTo(stackString);
            // Don't clear table card selections - allow combining hand + table cards
        }
    };

    const handleConfirmStack = () => {
        const result = confirmStack(
            selectedStackToAddTo,
            selectedHandCard,
            selectedTableCards,
            call,
            moveCount,
            players,
            currentTurn,
            onGameAction,
            collectedCards,
            team1Points,
            team2Points,
            team1SeepCount,
            team2SeepCount,
            lastCollector,
            handleConfirmAddToStack
        );

        if (result) {
            setPlayers(result.newPlayers);
            setSelectedHandCard(null);
            setSelectedTableCards([]);
            setMoveCount(result.nextMoveCount);
            setCurrentTurn(result.nextPlayerTurn);
            setShowDRCButton(result.nextShowDRCButton);
            if (result.newLastCollector !== undefined) {
                setLastCollector(result.newLastCollector);
            }
            
            // Check for end of round
            const endResult = checkEndOfRound(result.newPlayers, collectedCards, lastCollector);
            if (endResult) {
                setPlayers(endResult.players);
                setCollectedCards(endResult.collectedCards);
            }
        }
    };

    const handleConfirmAddToStack = () => {
        const result = confirmAddToStack(
            selectedStackToAddTo,
            selectedHandCard,
            selectedTableCards,
            players,
            currentTurn,
            moveCount,
            onGameAction,
            collectedCards,
            team1Points,
            team2Points,
            team1SeepCount,
            team2SeepCount,
            lastCollector
        );

        if (result) {
            setPlayers(result.newPlayers);
            setSelectedHandCard(null);
            setSelectedTableCards([]);
            setSelectedStackToAddTo(null);
            setMoveCount(result.nextMoveCount);
            setCurrentTurn(result.nextPlayerTurn);
            setShowDRCButton(result.nextShowDRCButton);
            if (result.newLastCollector !== undefined) {
                setLastCollector(result.newLastCollector);
            }
            
            // Check for end of round
            const endResult = checkEndOfRound(result.newPlayers, collectedCards, lastCollector);
            if (endResult) {
                setPlayers(endResult.players);
                setCollectedCards(endResult.collectedCards);
            }
        }
    };

    const handlePerformPickup = (allTableCards) => {
        const result = performPickup(
            selectedHandCard,
            allTableCards,
            players,
            currentTurn,
            collectedCards,
            team1SeepCount,
            team2SeepCount,
            team1Points,
            team2Points,
            moveCount,
            onGameAction
        );

        if (result) {
            setCollectedCards(result.newCollectedCards);
            setPlayers(result.newPlayers);
            setSelectedHandCard(null);
            setSelectedTableCards([]);
            setMoveCount(result.nextMoveCount);
            setCurrentTurn(result.nextPlayerTurn);
            setTeam1Points(result.newTeam1Points);
            setTeam2Points(result.newTeam2Points);
            setTeam1SeepCount(result.newTeam1SeepCount);
            setTeam2SeepCount(result.newTeam2SeepCount);
            setShowDRCButton(result.nextShowDRCButton);
            setLastCollector(currentTurn); // Set current player as last collector
            
            // Check for end of round
            const endResult = checkEndOfRound(result.newPlayers, result.newCollectedCards, currentTurn);
            if (endResult) {
                setPlayers(endResult.players);
                setCollectedCards(endResult.collectedCards);
            }
        }
    };

    const handlePickupAction = () => {
        handlePickup(
            selectedHandCard,
            selectedTableCards,
            call,
            moveCount,
            players,
            handlePerformPickup
        );
    };

    const handleThrowAwayAction = () => {
        const result = handleThrowAway(
            selectedHandCard,
            call,
            moveCount,
            players,
            currentTurn,
            collectedCards,
            team1Points,
            team2Points,
            team1SeepCount,
            team2SeepCount,
            lastCollector,
            onGameAction
        );

        if (result) {
            setPlayers(result.newPlayers);
            setSelectedHandCard(null);
            setMoveCount(result.nextMoveCount);
            setCurrentTurn(result.nextPlayerTurn);
            setShowDRCButton(result.nextShowDRCButton);
            if (result.newLastCollector !== undefined) {
                setLastCollector(result.newLastCollector);
            }
            
            // Check for end of round
            const endResult = checkEndOfRound(result.newPlayers, collectedCards, lastCollector);
            if (endResult) {
                setPlayers(endResult.players);
                setCollectedCards(endResult.collectedCards);
            }
        }
    };

    const isMyTurn = position === currentTurn;

    // Calculate selected card value for display
    const selectedHandValue = selectedHandCard ? getCardValue(formatCardName(selectedHandCard)) : 0;

    return (
        <TableUI
            // Game State
            players={players}
            currentTurn={currentTurn}
            position={position}
            playerNames={playerNames}
            boardVisible={boardVisible}
            call={call}
            moveCount={moveCount}
            isMyTurn={isMyTurn}
            dealVisible={dealVisible}
            showDRCButton={showDRCButton}
            
            // Selection State
            selectedHandCard={selectedHandCard}
            selectedTableCards={selectedTableCards}
            selectedStackToAddTo={selectedStackToAddTo}
            selectedHandValue={selectedHandValue}
            
            // Collected Cards & Scores
            collectedCards={collectedCards}
            team1Points={team1Points}
            team2Points={team2Points}
            
            // Event Handlers
            onHandCardSelection={handleHandCardSelection}
            onTableCardSelection={handleTableCardSelection}
            onExistingStackSelection={handleExistingStackSelection}
            onDealCards={dealCards}
            onDealRemainingCards={dealRemainingCards}
            onCall={handleCall}
            onPickup={handlePickupAction}
            onConfirmStack={handleConfirmStack}
            onConfirmAddToStack={handleConfirmAddToStack}
            onThrowAway={handleThrowAwayAction}
            onClearSelections={() => {
                setSelectedHandCard(null);
                setSelectedTableCards([]);
                setSelectedStackToAddTo(null);
            }}
        />
    );
}