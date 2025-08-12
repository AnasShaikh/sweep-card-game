// tableActions.js - Game action handlers

import {
    getStackValue,
    getStackTotalPoints,
    getStackCardCount,
    isLooseStack,
    getStackCreator,
    isTeammate,
    isOpponent,
    formatCardName,
    getCardValue,
    nextPlayer
} from './tableLogic';

export const confirmStack = (
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
    confirmAddToStackFn
) => {
    // Adding to existing stack
    if (selectedStackToAddTo) {
        return confirmAddToStackFn();
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

    return {
        newPlayers,
        nextPlayerTurn,
        nextMoveCount,
        nextShowDRCButton
    };
};

export const confirmAddToStack = (
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
    team2SeepCount
) => {
    if (!selectedStackToAddTo || !selectedHandCard) {
        alert("Please select one card from your hand and a stack to add to.");
        return;
    }

    const currentStackValue = getStackValue(selectedStackToAddTo);
    const handCardValue = getCardValue(formatCardName(selectedHandCard));
    
    // For adding to stack, we DON'T include the target stack in table cards value
    // Only include other table cards that are NOT the stack we're adding to
    const tableCardsValue = selectedTableCards
        .filter(card => card !== selectedStackToAddTo) // Exclude the target stack
        .reduce((sum, card) => {
            if (card.startsWith("Stack of")) {
                const stackVal = getStackValue(card);
                return sum + stackVal;
            }
            return sum + getCardValue(formatCardName(card));
        }, 0);
    
    const totalSelectedValue = handCardValue + tableCardsValue;
    const currentStackCardCount = getStackCardCount(selectedStackToAddTo);
    const newStackCardCount = currentStackCardCount + 1 + selectedTableCards.filter(card => card !== selectedStackToAddTo).length;

    // KEY FIX: Determine behavior type
    const isStackingOnTop = totalSelectedValue === currentStackValue;
    
    let newStackValue;
    
    if (isStackingOnTop) {
        // BEHAVIOR 1: Stacking on top - NO card limit, maintains stack value
        // This is ALWAYS allowed, even for tight stacks
        console.log(`Stacking on top: adding ${totalSelectedValue} to Stack of ${currentStackValue} - maintaining value`);
        
        // Check team permissions for pickup requirements
        const remainingCards = players[currentTurn].filter(card => card !== selectedHandCard);
        const hasPickupCard = remainingCards.some(card => getCardValue(formatCardName(card)) === currentStackValue);
        
        if (!hasPickupCard) {
            const stackCreator = getStackCreator(selectedStackToAddTo);
            
            // If it's teammate's stack, allow without pickup card (teammate can retrieve later)
            if (stackCreator && isTeammate(stackCreator, currentTurn)) {
                console.log(`Teammate stacking on top without pickup card requirement`);
            } else {
                // For own stack or opponent's stack or unknown creator, must have pickup card
                const stackOwnership = stackCreator === currentTurn ? "your own" : 
                                     (stackCreator && isOpponent(stackCreator, currentTurn)) ? "opponent's" : "this";
                alert(`You need at least one ${currentStackValue} card remaining in your hand to add to ${stackOwnership} stack.`);
                return;
            }
        }
        
        newStackValue = currentStackValue;
    } else {
        // BEHAVIOR 2: Value modification - check if stack allows modification
        if (!isLooseStack(selectedStackToAddTo)) {
            alert(`This stack is tight and cannot be modified. You can only add cards that sum exactly to ${currentStackValue} (stacking on top).`);
            return;
        }
        
        // 4 card limit applies for loose stack modifications
        if (newStackCardCount > 4) {
            alert(`Adding these cards would result in ${newStackCardCount} cards in the stack. Maximum is 4 cards for stack modification.`);
            return;
        }

        // Calculate new stack value based on actual card face values in stack
        const currentStackCards = selectedStackToAddTo.split(': ')[1] ? selectedStackToAddTo.split(': ')[1].split(' + ') : [];
        const allExistingCardValues = currentStackCards.reduce((sum, cardName) => {
            const trimmedCard = cardName.trim();
            if (trimmedCard.startsWith('Stack of')) {
                return sum + getStackValue(trimmedCard);
            }
            // Use face value, not scoring value
            return sum + getCardValue(formatCardName(trimmedCard));
        }, 0);
        
        const newTotalCardValue = allExistingCardValues + totalSelectedValue;
        
        console.log(`DEBUG: Stack cards: ${currentStackCards.join(', ')}`);
        console.log(`DEBUG: Existing values: ${allExistingCardValues}, Adding: ${totalSelectedValue}, New total: ${newTotalCardValue}`);
        
        console.log(`Value modification: existing cards total = ${allExistingCardValues}, adding ${totalSelectedValue}, new total = ${newTotalCardValue}`);
        
        // Find valid stack values (9-13) that the new total can form
        const possibleValues = [9, 10, 11, 12, 13].filter(val => {
            return newTotalCardValue >= val && newTotalCardValue % val === 0;
        });
        
        if (possibleValues.length === 0) {
            alert(`The new total card value (${newTotalCardValue}) cannot form a valid stack value (9-13). The total must be divisible by the stack value.`);
            return;
        }
        
        newStackValue = Math.max(...possibleValues);
        console.log(`Available stack values: ${possibleValues.join(', ')}, choosing: ${newStackValue}`);

        // Check if player has matching card for new stack value
        const remainingCards = players[currentTurn].filter(card => card !== selectedHandCard);
        const hasPickupCard = remainingCards.some(card => getCardValue(formatCardName(card)) === newStackValue);
        
        if (!hasPickupCard) {
            // Check team relationship for the stack
            const stackCreator = getStackCreator(selectedStackToAddTo);
            
            // If it's teammate's stack, allow without pickup card (teammate can retrieve later)
            if (stackCreator && isTeammate(stackCreator, currentTurn)) {
                console.log(`Teammate modifying stack without pickup card requirement`);
            } else {
                // For own stack, opponent's stack, or unknown creator, must have pickup card
                const stackOwnership = stackCreator === currentTurn ? "your own" : 
                                     (stackCreator && isOpponent(stackCreator, currentTurn)) ? "opponent's" : "this";
                alert(`You need at least one ${newStackValue} card remaining in your hand to modify ${stackOwnership} stack.`);
                return;
            }
        }
    }

    // Update the existing stack - remove selected table cards from board (excluding the target stack)
    const newBoard = players.board.filter(card => 
        card !== selectedStackToAddTo && !selectedTableCards.filter(tc => tc !== selectedStackToAddTo).includes(card)
    );
    
    // Create updated stack string with new value
    const otherSelectedCards = selectedTableCards.filter(card => card !== selectedStackToAddTo);
    const allSelectedCards = [selectedHandCard, ...otherSelectedCards];
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

    return {
        newPlayers,
        nextPlayerTurn,
        nextMoveCount,
        nextShowDRCButton
    };
};

export const handlePickup = (
    selectedHandCard,
    selectedTableCards,
    call,
    moveCount,
    performPickupFn
) => {
    if (!selectedHandCard) {
        alert("Please select exactly one card from your hand to pick up.");
        return;
    }

    if (selectedTableCards.length === 0) {
        alert("Please select cards from the table to pick up.");
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
            performPickupFn();
        } else {
            alert(`The selected cards' total value is not divisible by your card's value (${handCardValue}).`);
        }
    } else {
        if (handCardValue === tableCardsValue || tableCardsValue % handCardValue === 0) {
            performPickupFn();
        } else {
            alert("The selected cards do not add up to or are not divisible by the value of the card in your hand.");
        }
    }
};

export const performPickup = (
    selectedHandCard,
    selectedTableCards,
    players,
    currentTurn,
    collectedCards,
    team1SeepCount,
    team2SeepCount,
    team1Points,
    team2Points,
    moveCount,
    onGameAction
) => {
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

    return {
        newCollectedCards,
        newPlayers,
        nextPlayerTurn,
        nextMoveCount,
        newTeam1Points,
        newTeam2Points,
        newTeam1SeepCount,
        newTeam2SeepCount,
        nextShowDRCButton
    };
};

export const handleThrowAway = (
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
    onGameAction
) => {
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

    return {
        newPlayers,
        nextPlayerTurn,
        nextMoveCount,
        nextShowDRCButton
    };
};