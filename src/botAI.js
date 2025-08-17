// src/botAI.js - Bot AI logic for Seep card game
import { getCardValue, formatCardName, findAllPickupCombinations } from './tableLogic.js';

/**
 * Enhanced helper function to check for bot pickup opportunities (including seeps)
 * @param {Array} botHand - Bot's hand cards
 * @param {Array} boardCards - Cards on the board
 * @returns {Object|null} - Pickup opportunity or null
 */
export const canBotPickup = (botHand, boardCards) => {
  console.log('DEBUG: canBotPickup called with:');
  console.log('DEBUG: Hand cards:', botHand);
  console.log('DEBUG: Board cards:', boardCards);
  
  if (!boardCards || boardCards.length === 0) {
    console.log('DEBUG: No board cards available for pickup');
    return null;
  }
  
  let bestMove = null;
  
  for (const handCard of botHand) {
    const handValue = getCardValue(formatCardName(handCard));
    console.log('DEBUG: Checking hand card:', handCard, 'value:', handValue);
    
    // Check for pickup opportunities with this hand card
    for (const boardCard of boardCards) {
      const boardValue = getCardValue(formatCardName(boardCard));
      console.log('DEBUG: Comparing with board card:', boardCard, 'value:', boardValue);
      if (handValue === boardValue) {
        console.log('DEBUG: PICKUP FOUND! Hand card:', handCard, 'can pick up board card:', boardCard);
        
        // CRITICAL FIX: Use auto-expansion like human players
        const allPickupCards = findAllPickupCombinations(handValue, boardCards, [boardCard]);
        console.log('DEBUG: Auto-expanded pickup cards:', allPickupCards);
        
        // Check if this would be a seep (clear the entire board)
        const wouldBeSeep = allPickupCards.length === boardCards.length;
        console.log('DEBUG: Seep check - picking up', allPickupCards.length, 'out of', boardCards.length, 'cards. Is seep:', wouldBeSeep);
        
        return { 
          handCard, 
          boardCards: allPickupCards,
          isSeep: wouldBeSeep
        };
      }
    }
  }
  
  if (bestMove) {
    console.log('DEBUG: Best move found:', bestMove);
  } else {
    console.log('DEBUG: No pickup opportunities found');
  }
  
  return bestMove;
};

/**
 * Helper function to detect stack creation opportunities (following game rules)
 * @param {Array} botHand - Bot's hand cards
 * @param {Array} boardCards - Cards on the board
 * @param {number} call - The current call value
 * @returns {Object|null} - Stack opportunity or null
 */
export const canBotCreateStack = (botHand, boardCards, call) => {
  console.log('=== STACK DETECTION START ===');
  console.log('DEBUG: Checking stack creation opportunities with call:', call);
  
  if (!boardCards || boardCards.length < 2) {
    console.log('DEBUG: Not enough board cards for stacking');
    return null;
  }
  
  if (!call) {
    console.log('DEBUG: No call made yet - cannot create stacks');
    return null;
  }
  
  // Try different stack values that follow game rules
  for (const handCard of botHand) {
    const handValue = getCardValue(formatCardName(handCard));
    console.log('DEBUG: Checking hand card for stack:', handCard, 'value:', handValue);
    
    // RULE 1: Stack value must equal the call OR be a multiple of the call
    if (handValue !== call && handValue % call !== 0) {
      console.log('DEBUG: Skipping - stack value must equal call or be multiple of call. Value:', handValue, 'Call:', call);
      continue;
    }
    
    // RULE 2: Must have an extra card matching the call in hand (excluding the hand card being used)
    const remainingCards = botHand.filter(card => card !== handCard);
    const hasCallCard = remainingCards.some(card => getCardValue(formatCardName(card)) === call);
    
    if (!hasCallCard) {
      console.log('DEBUG: Skipping - need extra card matching call', call, 'in hand. Remaining cards:', remainingCards);
      continue;
    }
    
    // Find board cards that match this value
    const matchingBoardCards = boardCards.filter(boardCard => {
      const boardValue = getCardValue(formatCardName(boardCard));
      return boardValue === handValue;
    });
    
    // Need at least 1 matching board card to make a stack worthwhile
    if (matchingBoardCards.length >= 1) {
      console.log('DEBUG: 📚 VALID STACK OPPORTUNITY! Hand card:', handCard, 'Stack value:', handValue, 'Call:', call, 'Matching board cards:', matchingBoardCards);
      return {
        handCard,
        stackValue: handValue,
        boardCards: matchingBoardCards
      };
    }
  }
  
  console.log('DEBUG: No valid stack opportunities found following game rules');
  return null;
};

/**
 * Main bot decision-making function
 * Implements priority system: 1) Seeps, 2) Stacks, 3) Regular pickups, 4) Throw away
 * @param {Object} gameState - Current game state
 * @param {string} botPosition - Bot's position (plyr1, plyr2, plyr3, plyr4)
 * @returns {Object} - Bot move action
 */
export const generateBotMove = (gameState, botPosition) => {
  console.log(`=== BOT MOVE GENERATION START (${botPosition}) ===`);
  console.log('Current game state:', {
    moveCount: gameState.moveCount,
    currentTurn: gameState.currentTurn,
    call: gameState.call
  });
  
  try {
    const botHand = gameState.players[botPosition];
    const currentBoard = gameState.players.board || [];
    
    if (!botHand || botHand.length === 0) {
      console.log('WARNING: Bot has no cards in hand!');
      return null;
    }
    
    console.log('Bot analysis:', {
      position: botPosition,
      handSize: botHand.length,
      handCards: botHand,
      boardSize: currentBoard.length,
      boardCards: currentBoard
    });
    
    // Check for opportunities in priority order: 1) Seeps, 2) Stacks, 3) Regular pickups
    const pickupOpportunity = canBotPickup(botHand, currentBoard);
    const stackOpportunity = canBotCreateStack(botHand, currentBoard, gameState.call);
    
    // Priority 1: Seeps (highest priority)
    if (pickupOpportunity && pickupOpportunity.isSeep) {
      return createPickupAction(gameState, botPosition, pickupOpportunity, true);
    } 
    // Priority 2: Stack creation
    else if (stackOpportunity) {
      return createStackAction(gameState, botPosition, stackOpportunity);
    } 
    // Priority 3: Regular pickup
    else if (pickupOpportunity) {
      return createPickupAction(gameState, botPosition, pickupOpportunity, false);
    } 
    // Priority 4: No good options - just throw away a random card
    else {
      return createThrowAwayAction(gameState, botPosition);
    }
  } catch (error) {
    console.error('ERROR in generateBotMove:', error);
    // Fallback to throw away action
    return createThrowAwayAction(gameState, botPosition);
  }
};

/**
 * Create a pickup action for the bot
 * @param {Object} gameState - Current game state
 * @param {string} botPosition - Bot's position
 * @param {Object} pickupOpportunity - Pickup details
 * @param {boolean} isSeep - Whether this is a seep
 * @returns {Object} - Pickup action
 */
const createPickupAction = (gameState, botPosition, pickupOpportunity, isSeep) => {
  const { handCard, boardCards } = pickupOpportunity;
  const updatedHand = gameState.players[botPosition].filter(card => card !== handCard);
  const updatedBoard = gameState.players.board.filter(card => !boardCards.includes(card));
  
  // Add collected cards to bot's collection
  const newCollectedCards = {
    ...(gameState.collectedCards || { plyr1: [], plyr2: [], plyr3: [], plyr4: [] }),
    [botPosition]: [...(gameState.collectedCards?.[botPosition] || []), handCard, ...boardCards]
  };
  
  // Calculate seep points if board is cleared
  let newTeam1Points = gameState.team1Points;
  let newTeam2Points = gameState.team2Points;
  let newTeam1SeepCount = gameState.team1SeepCount;
  let newTeam2SeepCount = gameState.team2SeepCount;
  
  if (isSeep) {
    console.log('DEBUG: 🧹 Bot executed SEEP! Awarding 50 points');
    if (['plyr1', 'plyr3'].includes(botPosition)) {
      // Team 1 gets seep
      if (newTeam1SeepCount < 2) {
        newTeam1Points += 50;
        newTeam1SeepCount += 1;
        console.log('DEBUG: Team 1 seep awarded. New points:', newTeam1Points, 'Seep count:', newTeam1SeepCount);
      } else {
        newTeam1Points -= 50;
        newTeam1SeepCount -= 1;
        console.log('DEBUG: Team 1 seep penalty (over limit). New points:', newTeam1Points);
      }
    } else {
      // Team 2 gets seep  
      if (newTeam2SeepCount < 2) {
        newTeam2Points += 50;
        newTeam2SeepCount += 1;
        console.log('DEBUG: Team 2 seep awarded. New points:', newTeam2Points, 'Seep count:', newTeam2SeepCount);
      } else {
        newTeam2Points -= 50;
        newTeam2SeepCount -= 1;
        console.log('DEBUG: Team 2 seep penalty (over limit). New points:', newTeam2Points);
      }
    }
  }
  
  const updatedPlayers = { 
    ...gameState.players,
    [botPosition]: updatedHand,
    board: updatedBoard
  };
  
  // Move to next player
  const playerOrder = ['plyr2', 'plyr3', 'plyr4', 'plyr1'];
  const currentIndex = playerOrder.indexOf(botPosition);
  const nextPlayer = playerOrder[(currentIndex + 1) % 4];
  
  if (isSeep) {
    console.log('DEBUG: 🧹 Bot SEEP! Hand card:', handCard, 'cleared board:', boardCards);
  } else {
    console.log('DEBUG: Bot picking up cards:', handCard, 'collected:', boardCards);
  }
  
  return {
    action: 'pickup',
    players: updatedPlayers,
    currentTurn: nextPlayer,
    moveCount: gameState.moveCount + 1,
    collectedCards: newCollectedCards,
    // Add specific cards picked up for notification
    pickedUpCards: [handCard, ...boardCards],
    isSeep: isSeep,
    // Preserve all other game state with updated points
    deck: gameState.deck,
    call: gameState.call,
    boardVisible: gameState.boardVisible,
    dealVisible: gameState.dealVisible,
    remainingCardsDealt: gameState.remainingCardsDealt,
    showDRCButton: gameState.showDRCButton,
    team1SeepCount: newTeam1SeepCount,
    team2SeepCount: newTeam2SeepCount,
    team1Points: newTeam1Points,
    team2Points: newTeam2Points,
    lastCollector: gameState.lastCollector
  };
};

/**
 * Create a stack action for the bot
 * @param {Object} gameState - Current game state
 * @param {string} botPosition - Bot's position
 * @param {Object} stackOpportunity - Stack details
 * @returns {Object} - Stack action
 */
const createStackAction = (gameState, botPosition, stackOpportunity) => {
  const { handCard, stackValue, boardCards } = stackOpportunity;
  console.log('DEBUG: 📚 Bot creating stack with value:', stackValue);
  
  const updatedHand = gameState.players[botPosition].filter(card => card !== handCard);
  const updatedBoard = gameState.players.board.filter(card => !boardCards.includes(card));
  
  // Create the stack string
  const stackString = `Stack of ${stackValue} (by ${botPosition}): ${handCard} + ${boardCards.join(' + ')}`;
  updatedBoard.push(stackString);
  
  const updatedPlayers = { 
    ...gameState.players,
    [botPosition]: updatedHand,
    board: updatedBoard
  };
  
  // Move to next player
  const playerOrder = ['plyr2', 'plyr3', 'plyr4', 'plyr1'];
  const currentIndex = playerOrder.indexOf(botPosition);
  const nextPlayer = playerOrder[(currentIndex + 1) % 4];
  
  console.log('DEBUG: 📚 Bot created stack:', stackString);
  
  return {
    action: 'stack',
    players: updatedPlayers,
    currentTurn: nextPlayer,
    moveCount: gameState.moveCount + 1,
    // Add details for notification
    stackValue,
    stackCards: [handCard, ...boardCards],
    // Preserve all other game state
    deck: gameState.deck,
    call: gameState.call,
    boardVisible: gameState.boardVisible,
    collectedCards: gameState.collectedCards,
    dealVisible: gameState.dealVisible,
    remainingCardsDealt: gameState.remainingCardsDealt,
    showDRCButton: gameState.showDRCButton,
    team1SeepCount: gameState.team1SeepCount,
    team2SeepCount: gameState.team2SeepCount,
    team1Points: gameState.team1Points,
    team2Points: gameState.team2Points,
    lastCollector: gameState.lastCollector
  };
};

/**
 * Create a throw away action for the bot (fallback)
 * @param {Object} gameState - Current game state
 * @param {string} botPosition - Bot's position
 * @returns {Object} - Throw away action
 */
const createThrowAwayAction = (gameState, botPosition) => {
  // Priority 4: No good options - just throw away a random card
  const botHand = gameState.players[botPosition];
  const randomCardIndex = Math.floor(Math.random() * botHand.length);
  const cardToPlay = botHand[randomCardIndex];
  
  const updatedBoard = [...gameState.players.board, cardToPlay];
  const updatedHand = botHand.filter(card => card !== cardToPlay);
  
  const updatedPlayers = { 
    ...gameState.players,
    [botPosition]: updatedHand,
    board: updatedBoard
  };
  
  // Move to next player
  const playerOrder = ['plyr2', 'plyr3', 'plyr4', 'plyr1'];
  const currentIndex = playerOrder.indexOf(botPosition);
  const nextPlayer = playerOrder[(currentIndex + 1) % 4];
  
  console.log('DEBUG: Bot throwing away card:', cardToPlay);
  
  return {
    action: 'throwAway',
    players: updatedPlayers,
    currentTurn: nextPlayer,
    moveCount: gameState.moveCount + 1,
    // Preserve all other game state
    deck: gameState.deck,
    call: gameState.call,
    boardVisible: gameState.boardVisible,
    collectedCards: gameState.collectedCards,
    dealVisible: gameState.dealVisible,
    remainingCardsDealt: gameState.remainingCardsDealt,
    showDRCButton: gameState.showDRCButton,
    team1SeepCount: gameState.team1SeepCount,
    team2SeepCount: gameState.team2SeepCount,
    team1Points: gameState.team1Points,
    team2Points: gameState.team2Points,
    lastCollector: gameState.lastCollector
  };
};

/**
 * Get appropriate delay for bot moves (for realism)
 * @param {string} actionType - Type of action (pickup, stack, throwAway)
 * @returns {number} - Delay in milliseconds
 */
export const getBotMoveDelay = (actionType) => {
  switch (actionType) {
    case 'pickup':
    case 'stack':
      return 2000; // 2 seconds for strategic moves
    case 'throwAway':
      return 1500; // 1.5 seconds for simple moves
    default:
      return 2000;
  }
};