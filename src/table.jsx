import React, { useState, useEffect, useRef, useCallback } from 'react';
import initialDeck from './initialDeck';
import TableUI from './TableUI';
import {
    shuffleDeck,
    nextPlayer,
    checkValidCalls,
    getCardValue,
    formatCardName,
    calculatePoints,
    getTeam
} from './tableLogic';
import {
    confirmStack,
    confirmAddToStack,
    handlePickup,
    performPickup,
    handleThrowAway,
    handleEndOfRound
} from './tableActions';

export default function Table({ gameId, user, position, playerNames, socket, onGameAction, initialGameState, onTerminateGame }) {
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
    const [initialized, setInitialized] = useState(false);
    const [botMoveNotification, setBotMoveNotification] = useState(null);
    const [gameEnded, setGameEnded] = useState(false);
    const [winner, setWinner] = useState(null);
    
    // Timer state
    const [timeLeft, setTimeLeft] = useState(30);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [timerPlayerId, setTimerPlayerId] = useState(null);
    
    // Helper function to check if game has ended (all cards played)
    const checkGameEnd = () => {
        if (gameEnded) return; // Already ended
        
        // Check if game is complete: all hands empty AND deck empty
        const allHandsEmpty = players && ['plyr1', 'plyr2', 'plyr3', 'plyr4'].every(
            player => !players[player] || players[player].length === 0
        );
        
        const deckEmpty = !players?.deck || players.deck.length === 0;
        
        if (allHandsEmpty && deckEmpty && initialized) {
            // Calculate final scores
            const team1Total = (team1Points || 0) + calculatePoints(collectedCards?.plyr1 || []) + calculatePoints(collectedCards?.plyr3 || []);
            const team2Total = (team2Points || 0) + calculatePoints(collectedCards?.plyr2 || []) + calculatePoints(collectedCards?.plyr4 || []);
            
            const team1Name = `Team 1 (${getPlayerDisplayName('plyr1', playerNames)} & ${getPlayerDisplayName('plyr3', playerNames)})`;
            const team2Name = `Team 2 (${getPlayerDisplayName('plyr2', playerNames)} & ${getPlayerDisplayName('plyr4', playerNames)})`;
            
            if (team1Total > team2Total) {
                setWinner({ team: 'team1', name: team1Name, score: team1Total, opponentScore: team2Total });
            } else if (team2Total > team1Total) {
                setWinner({ team: 'team2', name: team2Name, score: team2Total, opponentScore: team1Total });
            } else {
                setWinner({ team: 'tie', name: 'Tie Game', score: team1Total, opponentScore: team2Total });
            }
            
            setGameEnded(true);
            console.log('🏆 Game ended! All cards played. Winner:', { team1Total, team2Total });
            
            // Update game status to 'finished' via socket
            if (socket && onGameAction) {
                onGameAction('gameFinished', {
                    winner: team1Total > team2Total ? 'team1' : team2Total > team1Total ? 'team2' : 'tie',
                    finalScores: { team1: team1Total, team2: team2Total },
                    winnerName: team1Total > team2Total ? team1Name : team2Total > team1Total ? team2Name : 'Tie Game'
                });
            }
        }
    };
    
    // Helper function to get player display name
    const getPlayerDisplayName = (position, playerNames) => {
        const playerData = playerNames[position];
        if (typeof playerData === 'object' && playerData.name) {
            return playerData.name; // Bot name
        } else if (typeof playerData === 'string') {
            return playerData; // Human player name
        }
        return 'Player';
    };
    
    // Helper function to show move notifications
    const showMoveNotification = (message) => {
        console.log('SHOWING NOTIFICATION:', message);
        setBotMoveNotification(message);
        setTimeout(() => setBotMoveNotification(null), 4000);
    };
    
    // Test notification on component mount
    useEffect(() => {
        console.log('TABLE COMPONENT MOUNTED - Testing notifications');
        showMoveNotification('Game loaded! 🎮');
    }, []);

    // Timer countdown effect
    useEffect(() => {
        let interval;
        if (isTimerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        setIsTimerActive(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isTimerActive, timeLeft]);
    
    const gameStateRef = useRef();
    const socketListenerSetup = useRef(false);
    
    // Initialize game state - ONLY run once when component mounts or initialGameState changes
    useEffect(() => {
        console.log('=== TABLE INITIALIZATION ===');
        console.log('Received initialGameState:', initialGameState);
        
        if (initialGameState) {
            console.log('InitialGameState players:', initialGameState?.players);
            console.log('InitialGameState deck:', initialGameState?.deck);
            console.log('InitialGameState currentTurn:', initialGameState?.currentTurn);
            console.log('InitialGameState boardVisible:', initialGameState?.boardVisible);
            console.log('InitialGameState call:', initialGameState?.call);
            
            // Set all state from initialGameState
            setDeck(initialGameState.deck || initialDeck);
            setPlayers(initialGameState.players || { plyr1: [], plyr2: [], plyr3: [], plyr4: [], board: [] });
            setCurrentTurn(initialGameState.currentTurn || 'plyr2');
            setMoveCount(initialGameState.moveCount || 0);
            setCall(initialGameState.call || null);
            // Board should be visible if:
            // 1. Explicitly set to visible, OR
            // 2. A call has been made, OR  
            // 3. We're past the initial move (move count > 1)
            const shouldShowBoard = initialGameState.boardVisible || 
                                   initialGameState.call || 
                                   (initialGameState.moveCount && initialGameState.moveCount > 1);
            setBoardVisible(shouldShowBoard);
            setCollectedCards(initialGameState.collectedCards || { plyr1: [], plyr2: [], plyr3: [], plyr4: [] });
            setDealVisible(initialGameState.dealVisible !== false);
            setRemainingCardsDealt(initialGameState.remainingCardsDealt || false);
            setShowDRCButton(initialGameState.showDRCButton || false);
            setTeam1SeepCount(initialGameState.team1SeepCount || 0);
            setTeam2SeepCount(initialGameState.team2SeepCount || 0);
            setTeam1Points(initialGameState.team1Points || 0);
            setTeam2Points(initialGameState.team2Points || 0);
            setLastCollector(initialGameState.lastCollector || null);
            
            // Clear selections on state load
            setSelectedHandCard(null);
            setSelectedTableCards([]);
            setSelectedStackToAddTo(null);
            
            setInitialized(true);
        } else {
            console.log('No initialGameState provided, using defaults');
            setInitialized(true);
        }
    }, [initialGameState]); // Only depend on initialGameState
    
    // Set up socket listeners - ONLY run once when socket changes
    useEffect(() => {
        if (!socket || socketListenerSetup.current) return;
        
        console.log('=== SETTING UP SOCKET LISTENERS ===');
        socketListenerSetup.current = true;
        
        const handleGameAction = ({ player, playerPosition, action, data }) => {
            console.log('=== RECEIVED GAME ACTION ===');
            console.log('Player:', player);
            console.log('PlayerPosition:', playerPosition);
            console.log('Action:', action);
            console.log('Data:', data);
            
            // Show move notifications for all players
            const getPlayerName = (playerId, position) => {
                // Use the provided position if available
                if (position) {
                    const playerData = playerNames[position];
                    if (typeof playerData === 'object' && playerData.name) {
                        return playerData.name; // Bot name
                    } else if (typeof playerData === 'string') {
                        return playerData; // Human player name
                    }
                }
                
                // Fallback: check if it's the current user
                if (playerId === user.id) {
                    return 'You';
                }
                
                return `Player ${position || playerId}`;
            };
            
            const playerName = getPlayerName(player, playerPosition);
            
            let notificationMessage = '';
            
            if (action === 'makeCall' && data.call) {
                notificationMessage = `${playerName} called ${data.call}`;
            } else if (action === 'throwAway') {
                // Use the thrown card directly from action data
                if (data.thrownCard) {
                    notificationMessage = `${playerName} threw: ${data.thrownCard}`;
                } else {
                    notificationMessage = `${playerName} threw a card`;
                }
            } else if (action === 'pickup') {
                // Find player position for this bot/player ID
                let playerPosition = null;
                
                // First, try to find position in current players object
                for (const [pos, id] of Object.entries(players || {})) {
                    if (id === player) {
                        playerPosition = pos;
                        break;
                    }
                }
                
                // If not found, try in data.players (for updated state)
                if (!playerPosition) {
                    for (const [pos, id] of Object.entries(data.players || {})) {
                        if (id === player) {
                            playerPosition = pos;
                            break;
                        }
                    }
                }
                
                console.log('DEBUG: Pickup notification - player:', player, 'position found:', playerPosition);
                console.log('DEBUG: Current players:', players);
                console.log('DEBUG: Data players:', data.players);
                
                // Check if the action data includes specific cards picked up (for bots)
                if (data.pickedUpCards && data.pickedUpCards.length > 0) {
                    const cardsList = data.pickedUpCards.join(', ');
                    if (data.isSeep) {
                        notificationMessage = `🧹 ${playerName} SEEP! Cleared board: ${cardsList} (+50 points)`;
                    } else {
                        notificationMessage = `${playerName} picked up: ${cardsList}`;
                    }
                    console.log('DEBUG: Using pickedUpCards from action data:', data.pickedUpCards, 'isSeep:', data.isSeep);
                } else if (playerPosition) {
                    const oldCollected = collectedCards[playerPosition] || [];
                    const newCollected = data.collectedCards[playerPosition] || [];
                    
                    console.log('DEBUG: Old collected:', oldCollected);
                    console.log('DEBUG: New collected:', newCollected);
                    
                    // Find the specific cards that were just picked up
                    const cardsJustPickedUp = newCollected.slice(oldCollected.length);
                    const cardsPickedUp = cardsJustPickedUp.length;
                    
                    console.log('DEBUG: Cards just picked up:', cardsJustPickedUp);
                    
                    if (cardsPickedUp > 0) {
                        // Show the specific cards picked up
                        const cardsList = cardsJustPickedUp.join(', ');
                        notificationMessage = `${playerName} picked up: ${cardsList}`;
                    } else {
                        notificationMessage = `${playerName} picked up ${cardsPickedUp} card${cardsPickedUp !== 1 ? 's' : ''}`;
                    }
                } else {
                    console.log('DEBUG: Player position not found, using fallback message');
                    notificationMessage = `${playerName} made a pickup`;
                }
            } else if (action === 'stack') {
                // Check if action data includes specific stack details (for bots)
                if (data.stackValue && data.stackCards) {
                    const cardsList = data.stackCards.join(', ');
                    notificationMessage = `📚 ${playerName} created Stack of ${data.stackValue}: ${cardsList}`;
                } else {
                    // Fallback for non-bot stack actions
                    const oldBoard = players.board || [];
                    const newBoard = data.players?.board || [];
                    const newStacks = newBoard.filter(card => card.startsWith('Stack of') && !oldBoard.includes(card));
                    if (newStacks.length > 0) {
                        const stackValue = newStacks[0].match(/Stack of (\d+)/)?.[1];
                        notificationMessage = `📚 ${playerName} created a stack of ${stackValue || '?'}`;
                    } else {
                        notificationMessage = `${playerName} made a stack`;
                    }
                }
            }
            
            if (notificationMessage) {
                console.log('SOCKET NOTIFICATION:', notificationMessage);
                setBotMoveNotification(notificationMessage);
                setTimeout(() => setBotMoveNotification(null), 4000);
            }
            
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
                    // Stop any active timer
                    setIsTimerActive(false);
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
                    // Stop any active timer
                    setIsTimerActive(false);
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
                    setBoardVisible(true); // Ensure board is visible during gameplay
                    setSelectedHandCard(null);
                    setSelectedTableCards([]);
                    setSelectedStackToAddTo(null);
                    // Stop any active timer
                    setIsTimerActive(false);
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
                    setBoardVisible(true); // Ensure board is visible during gameplay
                    if (data.lastCollector !== undefined) {
                        setLastCollector(data.lastCollector);
                    }
                    setSelectedHandCard(null);
                    setSelectedTableCards([]);
                    setSelectedStackToAddTo(null);
                    // Stop any active timer
                    setIsTimerActive(false);
                    break;
                    
                case 'autoMove':
                    setPlayers(data.players);
                    setCurrentTurn(data.currentTurn);
                    setMoveCount(data.moveCount);
                    setCollectedCards(data.collectedCards);
                    setTeam1Points(data.team1Points);
                    setTeam2Points(data.team2Points);
                    setTeam1SeepCount(data.team1SeepCount);
                    setTeam2SeepCount(data.team2SeepCount);
                    setShowDRCButton(data.showDRCButton);
                    setBoardVisible(true);
                    if (data.lastCollector !== undefined) {
                        setLastCollector(data.lastCollector);
                    }
                    // Stop any active timer
                    setIsTimerActive(false);
                    setSelectedHandCard(null);
                    setSelectedTableCards([]);
                    setSelectedStackToAddTo(null);
                    
                    // Show timeout notification
                    if (data.isTimeout && data.autoThrownCard) {
                        const playerName = getPlayerDisplayName(player, playerNames);
                        showMoveNotification(`⏰ ${playerName} timed out! Auto-threw: ${data.autoThrownCard}`);
                    }
                    break;
                    
                default:
                    break;
            }
        };
        
        const handleTimerStart = ({ playerId, timeLimit, startTime }) => {
            console.log('🔔 Timer started for player:', playerId, 'with', timeLimit, 'seconds');
            console.log('🔔 My position:', position, 'Timer player:', playerId, 'Match:', position === playerId);
            
            // Special debug for player 4
            if (playerId === 'plyr4' || position === 'plyr4') {
                console.log('🚨 PLAYER 4 CLIENT TIMER DEBUG:', {
                    myPosition: position,
                    timerForPlayer: playerId,
                    isMyTimer: position === playerId,
                    timeLimit,
                    startTime,
                    socketId: socket?.id,
                    eventReceived: true
                });
                
                // Additional debugging
                console.log('🚨 PLAYER 4 STATE BEFORE TIMER SET:', {
                    currentTimerPlayerId: timerPlayerId,
                    currentTimeLeft: timeLeft,
                    currentIsTimerActive: isTimerActive
                });
            }
            
            setTimerPlayerId(playerId);
            setTimeLeft(timeLimit);
            setIsTimerActive(true);
            
            // Debug after setting state for player 4
            if (playerId === 'plyr4' || position === 'plyr4') {
                setTimeout(() => {
                    console.log('🚨 PLAYER 4 STATE AFTER TIMER SET:', {
                        timerPlayerId: playerId,
                        timeLeft: timeLimit,
                        isTimerActive: true
                    });
                }, 100);
            }
        };

        const handleTimerStop = ({ playerId }) => {
            console.log('Timer stopped for player:', playerId);
            setIsTimerActive(false);
            setTimerPlayerId(null);
            setTimeLeft(30);
        };

        socket.on('gameAction', handleGameAction);
        socket.on('timerStart', handleTimerStart);
        socket.on('timerStop', handleTimerStop);
        
        return () => {
            socket.off('gameAction', handleGameAction);
            socket.off('timerStart', handleTimerStart);
            socket.off('timerStop', handleTimerStop);
            socketListenerSetup.current = false;
        };
    }, [socket]);
    
    const dealRemainingCards = useCallback(() => {
        console.log('🂴 DEALING REMAINING CARDS - Current state:', {
            deckLength: deck?.length || 0,
            deck: deck,
            playersHandSizes: {
                plyr1: players?.plyr1?.length || 0,
                plyr2: players?.plyr2?.length || 0,
                plyr3: players?.plyr3?.length || 0,
                plyr4: players?.plyr4?.length || 0
            }
        });
        
        let remainingCards = [...deck];
        let newPlayers = { ...players };
        
        if (remainingCards.length < 32) {
            console.log('⚠️ Not enough cards in deck to deal remaining cards. Expected 32, found:', remainingCards.length);
            return;
        }
        
        newPlayers.plyr1.push(...remainingCards.splice(0, 8));
        newPlayers.plyr2.push(...remainingCards.splice(0, 8));
        newPlayers.plyr3.push(...remainingCards.splice(0, 8));
        newPlayers.plyr4.push(...remainingCards.splice(0, 8));
        
        console.log('🂴 After dealing - New hand sizes:', {
            plyr1: newPlayers.plyr1.length,
            plyr2: newPlayers.plyr2.length,
            plyr3: newPlayers.plyr3.length,
            plyr4: newPlayers.plyr4.length,
            remainingDeck: remainingCards.length
        });
        
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
    }, [deck, players, onGameAction]);
    
    // Auto-deal remaining cards after move 3
    useEffect(() => {
        console.log('🂴 AUTO-DEAL CHECK:', {
            moveCount,
            remainingCardsDealt,
            initialized,
            deckLength: deck?.length || 0,
            shouldAutoDeal: moveCount === 4 && !remainingCardsDealt && initialized
        });
        
        if (moveCount === 4 && !remainingCardsDealt && initialized) {
            console.log('🂴 Auto-dealing remaining cards after move 3...');
            dealRemainingCards();
        }
    }, [moveCount, remainingCardsDealt, initialized, dealRemainingCards, deck]);
    
    // Check for game end when cards are played (hands/deck empty)
    useEffect(() => {
        if (initialized && players && collectedCards) {
            checkGameEnd();
        }
    }, [players, collectedCards, initialized, checkGameEnd, gameEnded, playerNames, team1Points, team2Points]);
    
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
    
    // Update game state - ONLY run when initialized and state actually changes
    useEffect(() => {
        if (!onGameAction || !initialized) return;
        
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
        const currentStateString = JSON.stringify(gameState);
        const previousStateString = JSON.stringify(gameStateRef.current);
        
        if (currentStateString !== previousStateString) {
            gameStateRef.current = gameState;
            onGameAction('updateGameState', gameState);
        }
    }, [
        initialized, onGameAction, deck, players, currentTurn, moveCount, call, 
        boardVisible, collectedCards, dealVisible, remainingCardsDealt, 
        showDRCButton, team1SeepCount, team2SeepCount, team1Points, 
        team2Points, lastCollector
    ]);


    const handleCall = (callValue) => {
        console.log('handleCall triggered with value:', callValue);
        setCall(callValue);
        setBoardVisible(true);
        showMoveNotification(`You called ${callValue}`);
        
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
        showMoveNotification(`You created a stack`);
        
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
        const cardCount = selectedTableCards.length + 1; // +1 for the hand card
        showMoveNotification(`You picked up ${cardCount} card${cardCount !== 1 ? 's' : ''}`);
        
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
        showMoveNotification(`You threw ${selectedHandCard}`);
        
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

    // Don't render until initialized
    if (!initialized) {
        return <div className="loading">Initializing game...</div>;
    }

    console.log('=== TABLE RENDER STATE ===');
    console.log('Players state:', players);
    console.log('Current turn:', currentTurn);
    console.log('Board visible:', boardVisible);
    console.log('Call:', call);
    console.log('Move count:', moveCount);
    console.log('My position:', position);
    console.log('Is my turn:', isMyTurn);
    console.log('Initialized:', initialized);

    // Game End Screen
    if (gameEnded && winner) {
        const userTeam = getTeam(position);
        const userWon = winner.team === userTeam;
        
        return (
            <div className="game-end-screen">
                <div className="victory-header">
                    {winner.team === 'tie' ? (
                        <>
                            <div className="celebration-emoji">🤝</div>
                            <h1 className="victory-title">What a Match!</h1>
                            <h2 className="victory-subtitle">Perfect Tie Game</h2>
                            <p className="victory-message">Both teams played brilliantly and scored exactly {winner.score} points!</p>
                        </>
                    ) : userWon ? (
                        <>
                            <div className="celebration-emoji">🎉</div>
                            <h1 className="victory-title">Victory!</h1>
                            <h2 className="victory-subtitle">You Won!</h2>
                            <p className="victory-message">Congratulations! Your team played brilliantly and secured the win!</p>
                        </>
                    ) : (
                        <>
                            <div className="celebration-emoji">😔</div>
                            <h1 className="victory-title defeat">Game Over</h1>
                            <h2 className="victory-subtitle">You Lost</h2>
                            <p className="victory-message">Better luck next time! {winner.name} played well and won this round.</p>
                        </>
                    )}
                </div>
                
                <div className="final-scores">
                    <h3>Final Scores</h3>
                    <div className="scores-grid">
                        <div className={`score-card ${winner.team === 'team1' ? 'winner' : ''}`}>
                            <div className="team-name">Team 1</div>
                            <div className="team-players">
                                {getPlayerDisplayName('plyr1', playerNames)} & {getPlayerDisplayName('plyr3', playerNames)}
                            </div>
                            <div className="team-score-large">
                                {winner.team === 'team1' ? winner.score : winner.opponentScore}
                            </div>
                            {winner.team === 'team1' && <div className="winner-badge">🏆 Winner</div>}
                        </div>
                        
                        <div className={`score-card ${winner.team === 'team2' ? 'winner' : ''}`}>
                            <div className="team-name">Team 2</div>
                            <div className="team-players">
                                {getPlayerDisplayName('plyr2', playerNames)} & {getPlayerDisplayName('plyr4', playerNames)}
                            </div>
                            <div className="team-score-large">
                                {winner.team === 'team2' ? winner.score : winner.opponentScore}
                            </div>
                            {winner.team === 'team2' && <div className="winner-badge">🏆 Winner</div>}
                        </div>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button 
                        onClick={() => window.location.href = '/lobby'}
                        style={{
                            padding: '1rem 2rem',
                            fontSize: '1.2rem',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
                    >
                        🎮 Start New Game
                    </button>
                    
                    <button 
                        onClick={() => window.location.href = '/lobby'}
                        style={{
                            padding: '1rem 2rem',
                            fontSize: '1.2rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#5a6268'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
                    >
                        🏠 Return to Lobby
                    </button>
                </div>
            </div>
        );
    }

    return (
        <TableUI
            // Game State
            players={players}
            currentTurn={currentTurn}
            position={position}
            playerNames={playerNames}
            botMoveNotification={botMoveNotification}
            boardVisible={boardVisible}
            call={call}
            moveCount={moveCount}
            isMyTurn={isMyTurn}
            dealVisible={dealVisible}
            showDRCButton={false} // Never show button since auto-deal is enabled
            
            // Selection State
            selectedHandCard={selectedHandCard}
            selectedTableCards={selectedTableCards}
            selectedStackToAddTo={selectedStackToAddTo}
            selectedHandValue={selectedHandValue}
            
            // Collected Cards & Scores
            collectedCards={collectedCards}
            team1Points={team1Points}
            team2Points={team2Points}
            
            // Timer State
            timeLeft={timeLeft}
            isTimerActive={isTimerActive}
            timerPlayerId={timerPlayerId}
            
            // Event Handlers
            onHandCardSelection={handleHandCardSelection}
            onTableCardSelection={handleTableCardSelection}
            onExistingStackSelection={handleExistingStackSelection}
            onDealCards={null} // REMOVED: No longer needed
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
            
            // NEW: Terminate Game
            onTerminateGame={onTerminateGame}
        />
    );
}