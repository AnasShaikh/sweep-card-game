import React, { useState, useEffect } from 'react';
import initialDeck from './initialDeck'; 

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
    
    // Team identification helper
    const getTeam = (playerPos) => {
        return ['plyr1', 'plyr3'].includes(playerPos) ? 'team1' : 'team2';
    };
    
    const isTeammate = (pos1, pos2) => {
        return getTeam(pos1) === getTeam(pos2);
    };
    
    const isOpponent = (pos1, pos2) => {
        return getTeam(pos1) !== getTeam(pos2);
    };
    
    // Extract stack value and total points from stack string
    const getStackValue = (stackString) => {
        if (stackString.startsWith('Stack of ')) {
            return parseInt(stackString.split(' ')[2].split(':')[0], 10);
        }
        return null;
    };
    
    // Calculate total points in a stack
    const getStackTotalPoints = (stackString) => {
        if (!stackString.startsWith('Stack of ')) return 0;
        
        const cardParts = stackString.split(': ')[1] ? stackString.split(': ')[1].split(' + ') : [];
        return cardParts.reduce((sum, card) => sum + getCardValue(formatCardName(card)), 0);
    };
    
    // Count total cards in a stack
    const getStackCardCount = (stackString) => {
        if (!stackString.startsWith('Stack of ')) return 0;
        
        const cardParts = stackString.split(': ')[1] ? stackString.split(': ')[1].split(' + ') : [];
        return cardParts.length;
    };
    
    // Check if stack is loose (modifiable) or tight (locked)
    const isLooseStack = (stackString, isStackingOnTop = false) => {
    if (isStackingOnTop) return true; // Always allow stacking matching value
    
    const stackValue = getStackValue(stackString);
    const totalPoints = getStackTotalPoints(stackString);
    const cardCount = getStackCardCount(stackString);
    
    // Tight if: 4+ cards OR double+ the base value
    const isTight = cardCount >= 4 || totalPoints >= (stackValue * 2);
    return !isTight;
    };
    
    // Get creator of a stack from board
    const getStackCreator = (stackString) => {
        // This is a simplified approach - in a real game you'd track stack creators
        // For now, we'll assume recent stacks are from recent players
        // This could be enhanced by storing creator info in stack strings
        return null; // Would need to be implemented based on your game state tracking
    };
    
    // Check if player can add to a specific stack
    const canAddToStack = (stackString, playerPos) => {
        const stackValue = getStackValue(stackString);
        if (!stackValue) return false;
        
        // Can't modify tight stacks
        if (!isLooseStack(stackString)) return false;
        
        const stackCreator = getStackCreator(stackString);
        
        // If we can't determine the creator, apply safest rules
        if (!stackCreator) {
            // Must have a card that can pick up the final stack value
            return players[playerPos].some(card => getCardValue(formatCardName(card)) >= 9);
        }
        
        // Self: can add if can pick up final stack
        if (stackCreator === playerPos) {
            return players[playerPos].some(card => getCardValue(formatCardName(card)) >= 9);
        }
        
        // Teammate: can add without pickup requirement  
        if (isTeammate(stackCreator, playerPos)) {
            return true;
        }
        
        // Opponent: can add only if can pick up final stack
        if (isOpponent(stackCreator, playerPos)) {
            return players[playerPos].some(card => getCardValue(formatCardName(card)) >= 9);
        }
        
        return false;
    };
    
    // Check if player can modify stack value (different from just adding to existing value)
    const canModifyStackValue = (stackString, playerPos) => {
        if (!isLooseStack(stackString)) return false;
        
        // Anyone can modify loose stacks by adding 1-4 cards
        return true;
    };
    
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
    
    // Update game state
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
            team2Points
        };
        
        onGameAction('updateGameState', gameState);
    }, [
        deck, players, currentTurn, moveCount, call, boardVisible,
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
        setCurrentTurn('plyr2'); // plyr2 starts first
        setCall(null);
        setBoardVisible(false);
        setSelectedHandCard(null);
        setSelectedTableCards([]);
        setSelectedStackToAddTo(null);
        setDealVisible(false);
        
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

    const confirmStack = () => {
        // Adding to existing stack
        if (selectedStackToAddTo) {
            return confirmAddToStack();
        }
        
        // Creating new stack (updated for max 4 cards)
        if (!selectedHandCard) {
            alert("Please select one card from your hand.");
            return;
        }

        if (selectedTableCards.length === 0) {
            alert("Please select one or more cards from the table.");
            return;
        }

        // Check maximum 4 cards total for new stack
        const totalCards = 1 + selectedTableCards.length; // 1 hand card + table cards
        if (totalCards > 4) {
            alert(`You can only use maximum 4 cards to create a stack. You selected ${totalCards} cards.`);
            return;
        }

        const handCardValue = getCardValue(formatCardName(selectedHandCard));
        const tableCardsValue = selectedTableCards.reduce((sum, card) => {
            if (card.startsWith("Stack of")) {
                return sum + getStackValue(card);
            }
            return sum + getCardValue(formatCardName(card));
        }, 0);
        const totalStackValue = handCardValue + tableCardsValue;

        let stackValue = call;

        if (moveCount > 1) {
            stackValue = parseInt(prompt("Enter the value of the stack (9, 10, 11, 12, 13):"), 10);

            if (![9, 10, 11, 12, 13].includes(stackValue)) {
                alert("Invalid stack value. It must be one of 9, 10, 11, 12, or 13.");
                return;
            }

            // Check if player has matching cards to eventually pick up this stack
            const matchingCardExists = players[currentTurn]
                .filter(card => card !== selectedHandCard)
                .some(card => getCardValue(formatCardName(card)) === stackValue);

            if (!matchingCardExists) {
                alert(`You need to have at least one more ${stackValue} in your hand to proceed.`);
                return;
            }

            if (totalStackValue % stackValue !== 0) {
                alert(`The total value of the stack must be a multiple of ${stackValue}.`);
                return;
            }

        } else {
            if (totalStackValue % call !== 0) {
                alert(`The stack value must be equal to or a multiple of your call (${call}).`);
                return;
            }

            const matchingCardExists = players[currentTurn]
                .filter(card => card !== selectedHandCard)
                .some(card => getCardValue(formatCardName(card)) === call);
                
            if (!matchingCardExists) {
                alert(`You need an extra card matching your call (${call}) in your hand to create this stack.`);
                return;
            }
        }

        // Create new stack
        const newBoard = players.board.filter(card => !selectedTableCards.includes(card));
        newBoard.push(`Stack of ${stackValue}: ${selectedHandCard} + ${selectedTableCards.join(' + ')}`);

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

    // Add to existing stack logic - now handles both exact match and value modification
    const confirmAddToStack = () => {
        if (!selectedStackToAddTo || !selectedHandCard) {
            alert("Please select one card from your hand and a stack to add to.");
            return;
        }

        const currentStackValue = getStackValue(selectedStackToAddTo);
        const handCardValue = getCardValue(formatCardName(selectedHandCard));
        const tableCardsValue = selectedTableCards.reduce((sum, card) => {
            if (card.startsWith("Stack of")) {
                const stackVal = getStackValue(card);
                return sum + stackVal;
            }
            return sum + getCardValue(formatCardName(card));
        }, 0);
        
        const totalSelectedValue = handCardValue + tableCardsValue;
        const newStackTotalPoints = getStackTotalPoints(selectedStackToAddTo) + totalSelectedValue;
        const newStackCardCount = getStackCardCount(selectedStackToAddTo) + 1 + selectedTableCards.length;

        // Check if adding would exceed 4 cards
        if (totalSelectedValue !== currentStackValue && newStackCardCount > 4) {
            alert(`Adding these cards would result in ${newStackCardCount} cards in the stack. Maximum is 4 cards.`);
            return;
        }

        // Determine new stack value and validate
        let newStackValue;
        
        // Check if this is exact match (maintaining current value)
        if (totalSelectedValue === currentStackValue) {
            newStackValue = currentStackValue;
            console.log(`Maintaining stack value ${currentStackValue}`);
        } else {
            // This is value modification - new stack value is based on new total points
            // Find valid stack value (9-13) that the new total can represent
            const possibleValues = [9, 10, 11, 12, 13].filter(val => 
                newStackTotalPoints >= val && newStackTotalPoints % val === 0
            );
            
            if (possibleValues.length === 0) {
                alert(`The new total points (${newStackTotalPoints}) cannot form a valid stack value (9-13).`);
                return;
            }
            
            // For now, use the highest possible value - could be made user-selectable
            newStackValue = Math.max(...possibleValues);
            console.log(`Modifying stack from ${currentStackValue} to ${newStackValue}`);
        }

        // Check team-based permissions for the new stack value
        const hasPickupCard = players[currentTurn]
            .filter(card => card !== selectedHandCard)
            .some(card => getCardValue(formatCardName(card)) === newStackValue);
            
        if (!hasPickupCard) {
            // Check if this is teammate adding (relaxed rules)
            const stackCreator = getStackCreator(selectedStackToAddTo);
            const isTeammateAdd = stackCreator && isTeammate(stackCreator, currentTurn);
            
            if (!isTeammateAdd) {
                alert(`You need at least one ${newStackValue} card remaining in your hand to add to this stack.`);
                return;
            }
        }

        // Update the existing stack - remove selected table cards from board
        const newBoard = players.board.filter(card => 
            card !== selectedStackToAddTo && !selectedTableCards.includes(card)
        );
        
        // Create updated stack string with new value
        const allSelectedCards = [selectedHandCard, ...selectedTableCards];
        const originalCards = selectedStackToAddTo.split(': ')[1] || '';
        newBoard.push(`Stack of ${newStackValue}: ${originalCards} + ${allSelectedCards.join(' + ')}`);

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
        setSelectedStackToAddTo(null);
        setMoveCount(nextMoveCount);
        setCurrentTurn(nextPlayerTurn);
        setShowDRCButton(nextShowDRCButton);

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

        if (selectedTableCards.length === 0) {
        alert("Cannot pickup from empty table. Use 'Throw Away' instead.");
        return;
        }

        if (!selectedHandCard) {
            alert("Please select exactly one card from your hand to pick up.");
            return;
        }

        const handCardValue = getCardValue(formatCardName(selectedHandCard));
        const tableCardsValue = selectedTableCards.reduce((sum, card) => {
            if (card.startsWith("Stack of")) {
                const stackValue = getStackValue(card);
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

        const boardCleared = newBoard.length === 0;
        
        let newTeam1Points = team1Points;
        let newTeam2Points = team2Points;
        let newTeam1SeepCount = team1SeepCount;
        let newTeam2SeepCount = team2SeepCount;

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
            alert("Please select exactly one card from your hand to throw away.");
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
            default: return 'plyr2';
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
                const stackValue = getStackValue(card);
                const isSelectedForAddTo = selectedStackToAddTo === card;
                const isSelectedAsTableCard = selectedTableCards.includes(card);
                const canAdd = canAddToStack(card, currentTurn);
                
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
                                setSelectedStackToAddTo(null);
                                return;
                            }
                            
                            // If already selected as table card, toggle off
                            if (isSelectedAsTableCard) {
                                handleTableCardSelection(card);
                                return;
                            }
                            
                            // Determine selection mode based on current selections
                            if (selectedStackToAddTo) {
                                // Already have a stack selected for adding to, so select this as table card
                                handleTableCardSelection(card);
                            } else if (selectedTableCards.length > 0 || selectedHandCard) {
                                // Have other selections, so this is likely for pickup - select as table card
                                handleTableCardSelection(card);
                            } else {
                                // No other selections, could be either pickup or add-to
                                // For now, default to table card selection (pickup mode)
                                // User can use "Add to Stack" button if they want add-to mode
                                handleTableCardSelection(card);
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
                                            handleTableCardSelection(card);
                                        }}
                                        className="stack-action-btn"
                                    >
                                        Select for Pickup
                                    </button>
                                    {canAdd && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleExistingStackSelection(card);
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
                    onClick={() => handleHandCardSelection(card)}
                >
                    <img src={imagePath} alt={card} className="cardImage" />
                </div>
            );
        });
    };
    
    const isMyTurn = position === currentTurn;

    // Calculate selected card value for display
    const selectedHandValue = selectedHandCard ? getCardValue(formatCardName(selectedHandCard)) : 0;

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
                {position === 'plyr1' && dealVisible && <button onClick={dealCards}>Deal Cards</button>}
                {isMyTurn && showDRCButton && <button onClick={dealRemainingCards}>Deal Remaining Cards</button>}
                
                {isMyTurn && moveCount === 1 && currentTurn === 'plyr2' && !call && (
                    <div>
                        <h4>{playerNames.plyr2}, make your call:</h4>
                        {checkValidCalls().map(num => (
                            <button key={num} onClick={() => handleCall(num)}>
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
                            {!selectedStackToAddTo && <button onClick={handlePickup}>Confirm Pickup</button>}
                            {!selectedStackToAddTo && <button onClick={confirmStack}>Create New Stack</button>}
                            {selectedStackToAddTo && <button onClick={confirmAddToStack}>Add to Stack</button>}
                            <button onClick={handleThrowAway}>Throw Away</button>
                        </div>
                        
                        {/* Clear selections button */}
                        <button 
                            onClick={() => {
                                setSelectedHandCard(null);
                                setSelectedTableCards([]);
                                setSelectedStackToAddTo(null);
                            }}
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