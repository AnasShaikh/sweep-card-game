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
    nextPlayer,
    findAllPickupCombinations,
    findAllStackCombinations
} from './tableLogic.js';

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
    lastCollector,
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

    // Check maximum 2 stacks rule
    const currentStackCount = players.board.filter(card => card.startsWith('Stack of')).length;
    if (currentStackCount >= 2) {
        alert("There can only be a maximum of 2 stacks on the table at one time.");
        return;
    }

    // Check maximum 4 cards total for new stack (before auto-expansion)
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

    // AUTO-EXPAND: Find all cards that should be included in this stack
    const allStackCards = findAllStackCombinations(stackValue, players.board, selectedTableCards, selectedHandCard);

    // Create new stack with all found cards
    const newBoard = players.board.filter(card => !allStackCards.includes(card));
    newBoard.push(`Stack of ${stackValue} (by ${currentTurn}): ${selectedHandCard} + ${allStackCards.join(' + ')}`);

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
            showDRCButton: nextShowDRCButton,
            lastCollector // Pass through last collector (unchanged for stack action)
        });
    }

    return {
        newPlayers,
        nextPlayerTurn,
        nextMoveCount,
        nextShowDRCButton,
        newLastCollector: lastCollector // No change to last collector for stack
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
    team2SeepCount,
    lastCollector
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
    let newBoard = players.board.filter(card => 
        card !== selectedStackToAddTo && !selectedTableCards.filter(tc => tc !== selectedStackToAddTo).includes(card)
    );
    
    // Create updated stack string with new value
    const otherSelectedCards = selectedTableCards.filter(card => card !== selectedStackToAddTo);
    const allSelectedCards = [selectedHandCard, ...otherSelectedCards];
    const originalCards = selectedStackToAddTo.split(': ')[1] || '';
    const newStackString = `Stack of ${newStackValue} (by ${currentTurn}): ${originalCards} + ${allSelectedCards.join(' + ')}`;
    
    // STACK MERGING LOGIC: Check if there's another stack with the same value
    const existingStackWithSameValue = newBoard.find(card => 
        card.startsWith('Stack of') && getStackValue(card) === newStackValue
    );
    
    if (existingStackWithSameValue) {
        console.log(`Found existing Stack of ${newStackValue}, merging stacks...`);
        
        // Remove the existing stack from board
        newBoard = newBoard.filter(card => card !== existingStackWithSameValue);
        
        // Extract ONLY the card names from both stacks (not the full strings)
        const existingStackCards = existingStackWithSameValue.split(': ')[1] || '';
        const newStackCards = originalCards + (originalCards ? ' + ' : '') + allSelectedCards.join(' + ');
        
        // Keep the original creator of the first stack
        const originalCreator = getStackCreator(existingStackWithSameValue);
        const mergedStackString = `Stack of ${newStackValue} (by ${originalCreator}): ${existingStackCards} + ${newStackCards}`;
        newBoard.push(mergedStackString);
        
        console.log(`Merged stack created: ${mergedStackString} (original creator: ${originalCreator})`);
    } else {
        // No existing stack with same value, just add the new/modified stack
        newBoard.push(newStackString);
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
            showDRCButton: nextShowDRCButton,
            lastCollector // Pass through last collector (unchanged for stack action)
        });
    }

    return {
        newPlayers,
        nextPlayerTurn,
        nextMoveCount,
        nextShowDRCButton,
        newLastCollector: lastCollector // No change to last collector for stack
    };
};

export const handlePickup = (
    selectedHandCard,
    selectedTableCards,
    call,
    moveCount,
    players,
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
    
    // Find ALL cards that can be picked up with this hand card (auto-expansion)
    const allPickupCards = findAllPickupCombinations(handCardValue, players.board, selectedTableCards);
    
    // Validate the manually selected cards first
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
            performPickupFn(allPickupCards);
        } else {
            alert(`The selected cards' total value is not divisible by your card's value (${handCardValue}).`);
        }
    } else {
        if (handCardValue === tableCardsValue || tableCardsValue % handCardValue === 0) {
            performPickupFn(allPickupCards);
        } else {
            alert("The selected cards do not add up to or are not divisible by the value of the card in your hand.");
        }
    }
};

export const performPickup = (
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
) => {
    const newBoard = players.board.filter(card => !allTableCards.includes(card));
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
        ...(collectedCards || { plyr1: [], plyr2: [], plyr3: [], plyr4: [] }),
        [currentTurn]: [...(collectedCards?.[currentTurn] || []), selectedHandCard, ...allTableCards]
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
            showDRCButton: nextShowDRCButton,
            lastCollector: currentTurn // Set current player as last collector
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
    lastCollector,
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
            showDRCButton: nextShowDRCButton,
            lastCollector, // Pass through last collector (unchanged for throw action)
            thrownCard: selectedHandCard // Include the card that was thrown
        });
    }

    return {
        newPlayers,
        nextPlayerTurn,
        nextMoveCount,
        nextShowDRCButton,
        newLastCollector: lastCollector // No change to last collector for throw
    };
};

// NEW FUNCTION: Handle end of round - assign remaining cards to last collector
export const handleEndOfRound = (players, lastCollector, collectedCards) => {
    if (!lastCollector || players.board.length === 0) {
        return null;
    }
    
    console.log(`End of round: Assigning ${players.board.length} remaining cards to ${lastCollector}`);
    
    const newCollectedCards = {
        ...(collectedCards || { plyr1: [], plyr2: [], plyr3: [], plyr4: [] }),
        [lastCollector]: [...(collectedCards?.[lastCollector] || []), ...players.board]
    };
    
    const newPlayers = {
        ...players,
        board: []
    };
    
    return {
        newCollectedCards,
        newPlayers
    };
};