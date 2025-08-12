// gameLogic.js - Core game mechanics and card operations

export const shuffleDeck = (deck) => deck.sort(() => Math.random() - 0.5);

export const formatCardName = (card) => {
    let [value, suit] = card.toLowerCase().split(' of ');
    if (value === 'j') value = 'jack';
    if (value === 'q') value = 'queen';
    if (value === 'k') value = 'king';
    if (value === 'a') value = 'ace';
    suit = suit.toLowerCase();
    return `${value}_of_${suit}`;
};

// Card value function (same as original - used for both face value AND scoring)
export const getCardValue = (card) => {
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

// Team identification helpers
export const getTeam = (playerPos) => {
    return ['plyr1', 'plyr3'].includes(playerPos) ? 'team1' : 'team2';
};

export const isTeammate = (pos1, pos2) => {
    return getTeam(pos1) === getTeam(pos2);
};

export const isOpponent = (pos1, pos2) => {
    return getTeam(pos1) !== getTeam(pos2);
};

export const nextPlayer = (current) => {
    switch (current) {
        case 'plyr1': return 'plyr2';
        case 'plyr2': return 'plyr3';
        case 'plyr3': return 'plyr4';
        case 'plyr4': return 'plyr1';
        default: return 'plyr2';
    }
};

// Stack operations
export const getStackValue = (stackString) => {
    if (stackString.startsWith('Stack of ')) {
        return parseInt(stackString.split(' ')[2].split(':')[0], 10);
    }
    return null;
};

export const getStackTotalPoints = (stackString) => {
    if (!stackString.startsWith('Stack of ')) return 0;
    
    const cardParts = stackString.split(': ')[1] ? stackString.split(': ')[1].split(' + ') : [];
    return cardParts.reduce((sum, card) => sum + getCardValue(formatCardName(card)), 0);
};

export const getStackCardCount = (stackString) => {
    if (!stackString.startsWith('Stack of ')) return 0;
    
    const cardParts = stackString.split(': ')[1] ? stackString.split(': ')[1].split(' + ') : [];
    return cardParts.length;
};

export const getStackCards = (stackString) => {
    if (!stackString.startsWith('Stack of ')) return [];
    return stackString.split(': ')[1] ? stackString.split(': ')[1].split(' + ') : [];
};

export const isLooseStack = (stackString, isStackingOnTop = false) => {
    if (isStackingOnTop) return true; // Always allow stacking matching value
    
    const stackValue = getStackValue(stackString);
    const totalPoints = getStackTotalPoints(stackString);
    const cardCount = getStackCardCount(stackString);
    
    // Tight if: 4+ cards OR double+ the base value
    const isTight = cardCount >= 4 || totalPoints >= (stackValue * 2);
    return !isTight;
};

export const getStackCreator = (stackString) => {
    // This would need to be enhanced to track stack creators
    // For now, return null as a placeholder
    return null;
};

export const canAddToStack = (stackString, playerPos, isStackingOnTop = false) => {
    const stackValue = getStackValue(stackString);
    if (!stackValue) return false;
    
    // Can't modify tight stacks unless stacking on top
    if (!isLooseStack(stackString, isStackingOnTop) && !isStackingOnTop) return false;
    
    const stackCreator = getStackCreator(stackString);
    
    // If we can't determine the creator, apply safest rules
    if (!stackCreator) {
        return true; // Allow for now, will be validated in confirm function
    }
    
    // Self: can add if can pick up final stack
    if (stackCreator === playerPos) {
        return true;
    }
    
    // Teammate: can add without pickup requirement  
    if (isTeammate(stackCreator, playerPos)) {
        return true;
    }
    
    // Opponent: can add only if can pick up final stack
    if (isOpponent(stackCreator, playerPos)) {
        return true; // Will be validated in confirm function
    }
    
    return false;
};

export const canModifyStackValue = (stackString, playerPos) => {
    if (!isLooseStack(stackString)) return false;
    return true;
};

export const checkValidCalls = (playerHand) => {
    const validCalls = playerHand
        .map(card => getCardValue(formatCardName(card)))
        .filter(value => value >= 9 && value <= 13);

    return [...new Set(validCalls)];
};

export const calculatePoints = (collectedCards) => {
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

// Validation functions
export const validatePickup = (selectedHandCard, selectedTableCards, call, moveCount) => {
    if (!selectedHandCard) {
        return { valid: false, message: "Please select exactly one card from your hand to pick up." };
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
            return { valid: false, message: `You must use the card that matches your call (${call}) to pick up.` };
        }

        if (tableCardsValue % handCardValue !== 0) {
            return { valid: false, message: `The selected cards' total value is not divisible by your card's value (${handCardValue}).` };
        }
    } else {
        if (handCardValue !== tableCardsValue && tableCardsValue % handCardValue !== 0) {
            return { valid: false, message: "The selected cards do not add up to or are not divisible by the value of the card in your hand." };
        }
    }

    return { valid: true };
};

export const validateThrowAway = (selectedHandCard, call, moveCount) => {
    if (!selectedHandCard) {
        return { valid: false, message: "Please select exactly one card from your hand to throw away." };
    }

    const handCardValue = getCardFaceValue(formatCardName(selectedHandCard));

    if (moveCount === 1) {
        if (handCardValue !== call) {
            return { valid: false, message: `The card you throw away must match your call (${call}).` };
        }
    }

    return { valid: true };
};

export const validateNewStack = (selectedHandCard, selectedTableCards, call, moveCount, playerHand) => {
    if (!selectedHandCard) {
        return { valid: false, message: "Please select one card from your hand." };
    }

    if (selectedTableCards.length === 0) {
        return { valid: false, message: "Please select one or more cards from the table." };
    }

    // Check maximum 4 cards total for new stack
    const totalCards = 1 + selectedTableCards.length;
    if (totalCards > 4) {
        return { valid: false, message: `You can only use maximum 4 cards to create a stack. You selected ${totalCards} cards.` };
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
            return { valid: false, message: "Invalid stack value. It must be one of 9, 10, 11, 12, or 13." };
        }

        const matchingCardExists = playerHand
            .filter(card => card !== selectedHandCard)
            .some(card => getCardValue(formatCardName(card)) === stackValue);

        if (!matchingCardExists) {
            return { valid: false, message: `You need to have at least one more ${stackValue} in your hand to proceed.` };
        }

        if (totalStackValue % stackValue !== 0) {
            return { valid: false, message: `The total value of the stack must be a multiple of ${stackValue}.` };
        }
    } else {
        if (totalStackValue % call !== 0) {
            return { valid: false, message: `The stack value must be equal to or a multiple of your call (${call}).` };
        }

        const matchingCardExists = playerHand
            .filter(card => card !== selectedHandCard)
            .some(card => getCardValue(formatCardName(card)) === call);
            
        if (!matchingCardExists) {
            return { valid: false, message: `You need an extra card matching your call (${call}) in your hand to create this stack.` };
        }
    }

    return { valid: true, stackValue };
};

// FIXED: Stack addition validation with two distinct behaviors
export const validateStackAddition = (selectedStackToAddTo, selectedHandCard, selectedTableCards, playerHand) => {
    if (!selectedStackToAddTo || !selectedHandCard) {
        return { valid: false, message: "Please select one card from your hand and a stack to add to." };
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
    const currentStackCardCount = getStackCardCount(selectedStackToAddTo);
    const newStackCardCount = currentStackCardCount + 1 + selectedTableCards.length;

    // Determine behavior: Stacking on top vs Value modification
    const isStackingOnTop = totalSelectedValue === currentStackValue;
    
    if (isStackingOnTop) {
        // BEHAVIOR 1: Stacking on top - NO card limit, maintains stack value
        console.log(`Stacking on top: adding ${totalSelectedValue} to Stack of ${currentStackValue} - maintaining value`);
        
        return { 
            valid: true, 
            newStackValue: currentStackValue,
            isStackingOnTop: true,
            message: `Stacking ${totalSelectedValue} on top of Stack of ${currentStackValue}` 
        };
    } else {
        // BEHAVIOR 2: Value modification - 4 card limit applies, changes stack value
        if (newStackCardCount > 4) {
            return { 
                valid: false, 
                message: `Adding these cards would result in ${newStackCardCount} cards in the stack. Maximum is 4 cards for stack modification.` 
            };
        }

        // Calculate new stack value based on total card values
        // FIX: Use actual card values from stack string, not point values
        const currentStackCards = selectedStackToAddTo.split(': ')[1] ? selectedStackToAddTo.split(': ')[1].split(' + ') : [];
        const allExistingCardValues = currentStackCards.reduce((sum, cardName) => {
            if (cardName.trim().startsWith('Stack of')) {
                return sum + getStackValue(cardName.trim());
            }
            return sum + getCardValue(formatCardName(cardName.trim()));
        }, 0);
        
        const newTotalCardValue = allExistingCardValues + totalSelectedValue;
        
        console.log(`Value modification: existing cards total = ${allExistingCardValues}, adding ${totalSelectedValue}, new total = ${newTotalCardValue}`);
        
        // Find valid stack values (9-13) that the new total can form
        const possibleValues = [9, 10, 11, 12, 13].filter(val => {
            return newTotalCardValue >= val && newTotalCardValue % val === 0;
        });
        
        if (possibleValues.length === 0) {
            return { 
                valid: false, 
                message: `The new total card value (${newTotalCardValue}) cannot form a valid stack value (9-13). The total must be divisible by the stack value.` 
            };
        }
        
        const newStackValue = Math.max(...possibleValues);
        console.log(`Available stack values: ${possibleValues.join(', ')}, choosing: ${newStackValue}`);

        // Check if player has matching card for new stack value
        const hasPickupCard = playerHand
            .filter(card => card !== selectedHandCard)
            .some(card => getCardValue(formatCardName(card)) === newStackValue);
            
        if (!hasPickupCard) {
            return { 
                valid: false, 
                message: `You need at least one ${newStackValue} card remaining in your hand to modify this stack.` 
            };
        }

        return { 
            valid: true, 
            newStackValue,
            isStackingOnTop: false,
            message: `Modifying stack from ${currentStackValue} to ${newStackValue}` 
        };
    }
};