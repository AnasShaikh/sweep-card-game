// tableLogic.js - Utility functions for table game logic

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

// Extract stack value and total points from stack string
export const getStackValue = (stackString) => {
    if (stackString.startsWith('Stack of ')) {
        return parseInt(stackString.split(' ')[2].split(':')[0], 10);
    }
    return null;
};

// Calculate total points in a stack
export const getStackTotalPoints = (stackString) => {
    if (!stackString.startsWith('Stack of ')) return 0;
    
    const cardParts = stackString.split(': ')[1] ? stackString.split(': ')[1].split(' + ') : [];
    return cardParts.reduce((sum, card) => sum + getCardValue(formatCardName(card)), 0);
};

// Count total cards in a stack
export const getStackCardCount = (stackString) => {
    if (!stackString.startsWith('Stack of ')) return 0;
    
    const cardParts = stackString.split(': ')[1] ? stackString.split(': ')[1].split(' + ') : [];
    return cardParts.length;
};

// Check if stack is loose (modifiable) or tight (locked)
export const isLooseStack = (stackString) => {
    const stackValue = getStackValue(stackString);
    const totalPoints = getStackTotalPoints(stackString);
    const cardCount = getStackCardCount(stackString);
    
    // Tight if: 4+ cards OR double+ the base value
    const isTight = cardCount >= 4 || totalPoints >= (stackValue * 2);
    return !isTight;
};

// Get creator of a stack from board
export const getStackCreator = (stackString) => {
    if (!stackString || !stackString.startsWith('Stack of ')) return null;
    
    const creatorMatch = stackString.match(/\(by (plyr[1-4])\)/);
    return creatorMatch ? creatorMatch[1] : null;
};

// Check if player can add to a specific stack
export const canAddToStack = (stackString, playerPos, players) => {
    const stackValue = getStackValue(stackString);
    if (!stackValue) return false;
    
    // Safety check - ensure players are initialized
    if (!players[playerPos] || !Array.isArray(players[playerPos]) || players[playerPos].length === 0) {
        return false;
    }
    
    // Can't modify tight stacks (for value modification)
    if (!isLooseStack(stackString)) {
        // But allow if they might be able to "stack on top" 
        // (we'll validate this properly in confirmAddToStack)
        return true;
    }
    
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
export const canModifyStackValue = (stackString, playerPos) => {
    if (!isLooseStack(stackString)) return false;
    
    // Anyone can modify loose stacks by adding 1-4 cards
    return true;
};

// Find all cards that can be picked up with the given hand card value
export const findAllPickupCombinations = (handCardValue, boardCards, selectedTableCards) => {
    const allPickupCards = [...selectedTableCards]; // Start with manually selected cards
    const remainingCards = boardCards.filter(card => !selectedTableCards.includes(card));
    
    // Find all single cards/stacks that match the hand card value
    const matchingSingleCards = remainingCards.filter(card => {
        if (card.startsWith('Stack of')) {
            return getStackValue(card) === handCardValue;
        } else {
            return getCardValue(formatCardName(card)) === handCardValue;
        }
    });
    
    allPickupCards.push(...matchingSingleCards);
    
    // Find combinations of non-stack cards that sum to multiples of hand card value
    const nonStackCards = remainingCards.filter(card => 
        !card.startsWith('Stack of') && 
        !matchingSingleCards.includes(card)
    );
    
    // Generate all possible combinations of remaining non-stack cards
    const combinations = getAllCombinations(nonStackCards);
    
    for (const combo of combinations) {
        const comboValue = combo.reduce((sum, card) => 
            sum + getCardValue(formatCardName(card)), 0
        );
        
        // Check if combination value is a multiple of hand card value
        if (comboValue === handCardValue) {
            // Make sure none of these cards are already picked up
            const canAddCombo = combo.every(card => !allPickupCards.includes(card));
            if (canAddCombo) {
                allPickupCards.push(...combo);
            }
        }
    }
    
    return allPickupCards;
};

// Find all cards that should be included when creating a stack of the given value
export const findAllStackCombinations = (stackValue, boardCards, selectedTableCards, selectedHandCard) => {
    const allStackCards = [...selectedTableCards]; // Start with manually selected cards
    const remainingCards = boardCards.filter(card => !selectedTableCards.includes(card));
    
    // Find all single cards/stacks that equal the stack value
    const matchingSingleCards = remainingCards.filter(card => {
        if (card.startsWith('Stack of')) {
            return getStackValue(card) === stackValue;
        } else {
            return getCardValue(formatCardName(card)) === stackValue;
        }
    });
    
    allStackCards.push(...matchingSingleCards);
    
    // Find combinations of non-stack cards that equal the stack value
    const nonStackCards = remainingCards.filter(card => 
        !card.startsWith('Stack of') && 
        !matchingSingleCards.includes(card)
    );
    
    // Generate all possible combinations of remaining non-stack cards
    const combinations = getAllCombinations(nonStackCards);
    
    for (const combo of combinations) {
        const comboValue = combo.reduce((sum, card) => 
            sum + getCardValue(formatCardName(card)), 0
        );
        
        // Check if combination value equals the stack value (not multiples)
        if (comboValue === stackValue) {
            // Make sure none of these cards are already included
            const canAddCombo = combo.every(card => !allStackCards.includes(card));
            if (canAddCombo) {
                allStackCards.push(...combo);
            }
        }
    }
    
    return allStackCards;
};

// Helper function to generate all possible combinations of an array
const getAllCombinations = (arr) => {
    const result = [];
    
    // Generate all possible combinations (2^n - 1, excluding empty set)
    for (let i = 1; i < Math.pow(2, arr.length); i++) {
        const combo = [];
        for (let j = 0; j < arr.length; j++) {
            if (i & Math.pow(2, j)) {
                combo.push(arr[j]);
            }
        }
        result.push(combo);
    }
    
    return result;
};

// Card and deck utilities
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

export const nextPlayer = (current) => {
    switch (current) {
        case 'plyr1': return 'plyr2';
        case 'plyr2': return 'plyr3';
        case 'plyr3': return 'plyr4';
        case 'plyr4': return 'plyr1';
        default: return 'plyr2';
    }
};

export const calculatePoints = (collectedCards) => {
    // Safety check - ensure we have a valid array
    if (!Array.isArray(collectedCards)) {
        console.warn('calculatePoints called with non-array:', collectedCards);
        return 0;
    }
    
    return collectedCards.reduce((total, card) => {
        // Ensure total is a number
        if (typeof total !== 'number' || isNaN(total)) {
            console.warn('calculatePoints: invalid total value:', total);
            total = 0;
        }
        
        // Ensure card is a string
        if (typeof card !== 'string') {
            console.warn('calculatePoints: invalid card type:', card, typeof card);
            return total;
        }
        
        // Handle stack strings - extract individual cards from stacks
        if (card.startsWith('Stack of')) {
            const cardParts = card.split(': ')[1] ? card.split(': ')[1].split(' + ') : [];
            const stackPoints = cardParts.reduce((stackTotal, stackCard) => {
                const trimmedCard = stackCard.trim();
                // Skip nested stacks to avoid double counting
                if (trimmedCard.startsWith('Stack of')) return stackTotal;
                
                const value = getCardValue(formatCardName(trimmedCard));
                const suitMatch = trimmedCard.match(/of\s+(\w+)/i);
                const suit = suitMatch ? suitMatch[1].toLowerCase() : '';

                if (suit === 'spades') {
                    return stackTotal + value;
                } else if (value === 1) { // Aces
                    return stackTotal + 1;
                } else if (trimmedCard.toLowerCase() === '10 of diamonds') {
                    return stackTotal + 6;
                } else {
                    return stackTotal;
                }
            }, 0);
            return total + stackPoints;
        } else {
            // Handle regular cards
            const value = getCardValue(formatCardName(card));
            const suit = card.split(' ')[2]?.toLowerCase() || '';

            if (suit === 'spades') {
                return total + value;
            } else if (value === 1) { // Aces
                return total + 1;
            } else if (card.toLowerCase() === '10 of diamonds') {
                return total + 6;
            } else {
                return total;
            }
        }
    }, 0);
};

export const checkValidCalls = (playerHand) => {
    const validCalls = playerHand
        .map(card => getCardValue(formatCardName(card)))
        .filter(value => value >= 9 && value <= 13);

    return [...new Set(validCalls)];
};