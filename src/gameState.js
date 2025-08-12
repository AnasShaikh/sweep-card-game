// gameState.js - State management and game flow

import { 
    shuffleDeck, 
    nextPlayer, 
    calculatePoints,
    validatePickup,
    validateThrowAway,
    validateNewStack,
    validateStackAddition,
    formatCardName,
    getCardFaceValue,
    getStackCards
} from './gameLogic.js';

export const createInitialState = (initialDeck, initialGameState) => {
    if (initialGameState) {
        return {
            deck: initialGameState.deck || initialDeck,
            players: initialGameState.players || { plyr1: [], plyr2: [], plyr3: [], plyr4: [], board: [] },
            currentTurn: initialGameState.currentTurn || 'plyr2',
            moveCount: initialGameState.moveCount || 0,
            call: initialGameState.call || null,
            boardVisible: initialGameState.boardVisible || false,
            collectedCards: initialGameState.collectedCards || { plyr1: [], plyr2: [], plyr3: [], plyr4: [] },
            dealVisible: initialGameState.dealVisible !== false,
            remainingCardsDealt: initialGameState.remainingCardsDealt || false,
            showDRCButton: initialGameState.showDRCButton || false,
            team1SeepCount: initialGameState.team1SeepCount || 0,
            team2SeepCount: initialGameState.team2SeepCount || 0,
            team1Points: initialGameState.team1Points || 0,
            team2Points: initialGameState.team2Points || 0
        };
    }
    
    return {
        deck: initialDeck,
        players: { plyr1: [], plyr2: [], plyr3: [], plyr4: [], board: [] },
        currentTurn: 'plyr2',
        moveCount: 0,
        call: null,
        boardVisible: false,
        collectedCards: { plyr1: [], plyr2: [], plyr3: [], plyr4: [] },
        dealVisible: true,
        remainingCardsDealt: false,
        showDRCButton: false,
        team1SeepCount: 0,
        team2SeepCount: 0,
        team1Points: 0,
        team2Points: 0
    };
};

export const handleDealCards = (gameState, onGameAction) => {
    let shuffledDeck = shuffleDeck([...gameState.deck]);
    let newPlayers = {
        plyr1: shuffledDeck.splice(0, 4),
        plyr2: shuffledDeck.splice(0, 4),
        plyr3: shuffledDeck.splice(0, 4),
        plyr4: shuffledDeck.splice(0, 4),
        board: shuffledDeck.splice(0, 4)
    };
    
    const newState = {
        ...gameState,
        players: newPlayers,
        deck: shuffledDeck,
        moveCount: 1,
        currentTurn: 'plyr2',
        call: null,
        boardVisible: false,
        dealVisible: false
    };
    
    if (onGameAction) {
        onGameAction('dealCards', {
            players: newPlayers,
            deck: shuffledDeck
        });
    }
    
    return newState;
};

export const handleDealRemainingCards = (gameState, onGameAction) => {
    let remainingCards = [...gameState.deck];
    let newPlayers = { ...gameState.players };
    newPlayers.plyr1.push(...remainingCards.splice(0, 8));
    newPlayers.plyr2.push(...remainingCards.splice(0, 8));
    newPlayers.plyr3.push(...remainingCards.splice(0, 8));
    newPlayers.plyr4.push(...remainingCards.splice(0, 8));
    
    const newState = {
        ...gameState,
        players: newPlayers,
        deck: remainingCards,
        remainingCardsDealt: true,
        showDRCButton: false
    };
    
    if (onGameAction) {
        onGameAction('dealRemainingCards', {
            players: newPlayers,
            deck: remainingCards
        });
    }
    
    return newState;
};

export const handleCall = (gameState, callValue, onGameAction) => {
    const newState = {
        ...gameState,
        call: callValue,
        boardVisible: true
    };
    
    if (onGameAction) {
        onGameAction('makeCall', { call: callValue });
    }
    
    return newState;
};

export const handlePickup = (gameState, selectedHandCard, selectedTableCards, onGameAction) => {
    const validation = validatePickup(selectedHandCard, selectedTableCards, gameState.call, gameState.moveCount);
    if (!validation.valid) {
        alert(validation.message);
        return gameState;
    }

    const newBoard = gameState.players.board.filter(card => 
        !selectedTableCards.includes(card) && 
        !card.includes(`Stack of ${getCardFaceValue(formatCardName(selectedHandCard))}`)
    );
    const newHand = gameState.players[gameState.currentTurn].filter(card => card !== selectedHandCard);

    const boardCleared = newBoard.length === 0;
    
    let newTeam1Points = gameState.team1Points;
    let newTeam2Points = gameState.team2Points;
    let newTeam1SeepCount = gameState.team1SeepCount;
    let newTeam2SeepCount = gameState.team2SeepCount;

    if (boardCleared) {
        if (['plyr1', 'plyr3'].includes(gameState.currentTurn)) {
            if (newTeam1SeepCount < 2) {
                newTeam1Points += 50;
                newTeam1SeepCount += 1;
            } else {
                newTeam1Points -= 50;
                newTeam1SeepCount -= 1;
            }
        } else if (['plyr2', 'plyr4'].includes(gameState.currentTurn)) {
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
        ...gameState.collectedCards,
        [gameState.currentTurn]: [...gameState.collectedCards[gameState.currentTurn], selectedHandCard, ...selectedTableCards]
    };
    
    const nextPlayerTurn = nextPlayer(gameState.currentTurn);
    const nextMoveCount = gameState.moveCount + 1;
    const nextShowDRCButton = nextMoveCount === 4;

    const newPlayers = {
        ...gameState.players,
        [gameState.currentTurn]: newHand,
        board: newBoard
    };

    const newState = {
        ...gameState,
        collectedCards: newCollectedCards,
        players: newPlayers,
        currentTurn: nextPlayerTurn,
        moveCount: nextMoveCount,
        team1Points: newTeam1Points,
        team2Points: newTeam2Points,
        team1SeepCount: newTeam1SeepCount,
        team2SeepCount: newTeam2SeepCount,
        showDRCButton: nextShowDRCButton
    };

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

    return newState;
};

export const handleThrowAway = (gameState, selectedHandCard, onGameAction) => {
    const validation = validateThrowAway(selectedHandCard, gameState.call, gameState.moveCount);
    if (!validation.valid) {
        alert(validation.message);
        return gameState;
    }

    const newBoard = [...gameState.players.board, selectedHandCard];
    const newHand = gameState.players[gameState.currentTurn].filter(card => card !== selectedHandCard);
    const nextPlayerTurn = nextPlayer(gameState.currentTurn);
    const nextMoveCount = gameState.moveCount + 1;
    const nextShowDRCButton = nextMoveCount === 4;

    const newPlayers = {
        ...gameState.players,
        [gameState.currentTurn]: newHand,
        board: newBoard
    };

    const newState = {
        ...gameState,
        players: newPlayers,
        currentTurn: nextPlayerTurn,
        moveCount: nextMoveCount,
        showDRCButton: nextShowDRCButton
    };

    if (onGameAction) {
        onGameAction('throwAway', {
            players: newPlayers,
            currentTurn: nextPlayerTurn,
            moveCount: nextMoveCount,
            collectedCards: gameState.collectedCards,
            team1Points: gameState.team1Points,
            team2Points: gameState.team2Points,
            team1SeepCount: gameState.team1SeepCount,
            team2SeepCount: gameState.team2SeepCount,
            showDRCButton: nextShowDRCButton
        });
    }

    return newState;
};

export const handleCreateStack = (gameState, selectedHandCard, selectedTableCards, onGameAction) => {
    const validation = validateNewStack(
        selectedHandCard, 
        selectedTableCards, 
        gameState.call, 
        gameState.moveCount, 
        gameState.players[gameState.currentTurn]
    );
    
    if (!validation.valid) {
        alert(validation.message);
        return gameState;
    }

    const newBoard = gameState.players.board.filter(card => !selectedTableCards.includes(card));
    newBoard.push(`Stack of ${validation.stackValue}: ${selectedHandCard} + ${selectedTableCards.join(' + ')}`);

    const newHand = gameState.players[gameState.currentTurn].filter(card => card !== selectedHandCard);
    const nextPlayerTurn = nextPlayer(gameState.currentTurn);
    const nextMoveCount = gameState.moveCount + 1;
    const nextShowDRCButton = nextMoveCount === 4;

    const newPlayers = {
        ...gameState.players,
        [gameState.currentTurn]: newHand,
        board: newBoard
    };

    const newState = {
        ...gameState,
        players: newPlayers,
        currentTurn: nextPlayerTurn,
        moveCount: nextMoveCount,
        showDRCButton: nextShowDRCButton
    };

    if (onGameAction) {
        onGameAction('stack', {
            players: newPlayers,
            currentTurn: nextPlayerTurn,
            moveCount: nextMoveCount,
            collectedCards: gameState.collectedCards,
            team1Points: gameState.team1Points,
            team2Points: gameState.team2Points,
            team1SeepCount: gameState.team1SeepCount,
            team2SeepCount: gameState.team2SeepCount,
            showDRCButton: nextShowDRCButton
        });
    }

    return newState;
};

export const handleAddToStack = (gameState, selectedStackToAddTo, selectedHandCard, selectedTableCards, onGameAction) => {
    const validation = validateStackAddition(
        selectedStackToAddTo,
        selectedHandCard,
        selectedTableCards,
        gameState.players[gameState.currentTurn]
    );
    
    if (!validation.valid) {
        alert(validation.message);
        return gameState;
    }

    console.log(validation.message);

    // Update the existing stack - remove selected table cards from board
    const newBoard = gameState.players.board.filter(card => 
        card !== selectedStackToAddTo && !selectedTableCards.includes(card)
    );
    
    // Create updated stack string with new value
    const allSelectedCards = [selectedHandCard, ...selectedTableCards];
    const originalCards = selectedStackToAddTo.split(': ')[1] || '';
    newBoard.push(`Stack of ${validation.newStackValue}: ${originalCards} + ${allSelectedCards.join(' + ')}`);

    const newHand = gameState.players[gameState.currentTurn].filter(card => card !== selectedHandCard);
    const nextPlayerTurn = nextPlayer(gameState.currentTurn);
    const nextMoveCount = gameState.moveCount + 1;
    const nextShowDRCButton = nextMoveCount === 4;

    const newPlayers = {
        ...gameState.players,
        [gameState.currentTurn]: newHand,
        board: newBoard
    };

    const newState = {
        ...gameState,
        players: newPlayers,
        currentTurn: nextPlayerTurn,
        moveCount: nextMoveCount,
        showDRCButton: nextShowDRCButton
    };

    if (onGameAction) {
        onGameAction('stack', {
            players: newPlayers,
            currentTurn: nextPlayerTurn,
            moveCount: nextMoveCount,
            collectedCards: gameState.collectedCards,
            team1Points: gameState.team1Points,
            team2Points: gameState.team2Points,
            team1SeepCount: gameState.team1SeepCount,
            team2SeepCount: gameState.team2SeepCount,
            showDRCButton: nextShowDRCButton
        });
    }

    return newState;
};

export const processSocketAction = (gameState, action, data) => {
    switch (action) {
        case 'dealCards':
            return {
                ...gameState,
                players: data.players,
                deck: data.deck,
                moveCount: 1,
                currentTurn: 'plyr2',
                call: null,
                boardVisible: false,
                dealVisible: false
            };
            
        case 'dealRemainingCards':
            return {
                ...gameState,
                players: data.players,
                deck: data.deck,
                remainingCardsDealt: true,
                showDRCButton: false
            };
            
        case 'makeCall':
            return {
                ...gameState,
                call: data.call,
                boardVisible: true
            };
            
        case 'pickup':
        case 'throwAway':
        case 'stack':
            return {
                ...gameState,
                players: data.players,
                currentTurn: data.currentTurn,
                moveCount: data.moveCount,
                collectedCards: data.collectedCards,
                team1Points: data.team1Points,
                team2Points: data.team2Points,
                team1SeepCount: data.team1SeepCount,
                team2SeepCount: data.team2SeepCount,
                showDRCButton: data.showDRCButton
            };
            
        default:
            return gameState;
    }
};