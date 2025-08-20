// src/botAI.js - Enhanced Bot AI logic for Seep card game
import { getCardValue, formatCardName, findAllPickupCombinations, getStackValue, canAddToStack, getStackCreator } from './tableLogic.js';
import { confirmStack, confirmAddToStack } from './tableActions.js';

// === ADVANCED BOT AI SYSTEM ===

/**
 * Card evaluation system - assigns strategic value to cards
 * @param {string} card - Card to evaluate
 * @param {Array} boardCards - Current board state
 * @param {Object} gameContext - Additional game context
 * @returns {number} - Strategic value score
 */
export const evaluateCard = (card, boardCards = [], gameContext = {}) => {
  const cardValue = getCardValue(formatCardName(card));
  const cardName = card.toLowerCase();
  let score = 0;
  
  // Base point values (Seep scoring system)
  if (cardName.includes('spades')) {
    score += cardValue; // Spades = face value points
  } else if (cardValue === 1) {
    score += 1; // Aces = 1 point each
  } else if (cardName === '10 of diamonds') {
    score += 6; // Special card = 6 points
  }
  
  // Strategic value bonuses
  
  // High pickup potential (can collect many board cards)
  const matchingBoardCards = boardCards.filter(boardCard => {
    const boardValue = getCardValue(formatCardName(boardCard));
    return boardValue === cardValue;
  });
  score += matchingBoardCards.length * 2; // +2 for each matching board card
  
  // Seep potential (can clear entire board)
  if (matchingBoardCards.length === boardCards.length && boardCards.length > 0) {
    score += 50; // Massive bonus for seep opportunity
  }
  
  // Stack creation potential
  if (gameContext.call && (cardValue === gameContext.call || cardValue % gameContext.call === 0)) {
    score += 3; // Bonus for stack-eligible cards
  }
  
  // Defensive value (prevents opponent opportunities)
  if (cardValue >= 10) {
    score += 2; // High cards are often defensive
  }
  
  return score;
};

/**
 * Game memory system - tracks played cards and infers opponent hands
 * @param {Object} gameState - Current game state
 * @returns {Object} - Memory analysis
 */
export const analyzeGameMemory = (gameState) => {
  const fullDeck = generateFullDeck();
  const playedCards = getPlayedCards(gameState);
  const remainingCards = fullDeck.filter(card => !playedCards.includes(card));
  
  return {
    playedCards,
    remainingCards,
    totalPlayed: playedCards.length,
    remainingCount: remainingCards.length,
    // Probability analysis for opponent hands
    opponentHandEstimates: estimateOpponentHands(gameState, remainingCards)
  };
};

/**
 * Generate complete deck for memory tracking
 * @returns {Array} - Full 52-card deck
 */
const generateFullDeck = () => {
  const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
  const values = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
  const deck = [];
  
  suits.forEach(suit => {
    values.forEach(value => {
      deck.push(`${value} of ${suit}`);
    });
  });
  
  return deck;
};

/**
 * Extract all played cards from game state
 * @param {Object} gameState - Current game state
 * @returns {Array} - All played cards
 */
const getPlayedCards = (gameState) => {
  const played = [];
  
  // Add all cards currently in hands
  Object.keys(gameState.players).forEach(player => {
    if (player !== 'board' && Array.isArray(gameState.players[player])) {
      played.push(...gameState.players[player]);
    }
  });
  
  // Add board cards
  if (Array.isArray(gameState.players.board)) {
    played.push(...gameState.players.board);
  }
  
  // Add collected cards
  if (gameState.collectedCards) {
    Object.values(gameState.collectedCards).forEach(collection => {
      if (Array.isArray(collection)) {
        played.push(...collection);
      }
    });
  }
  
  return played;
};

/**
 * Estimate what cards opponents might hold
 * @param {Object} gameState - Current game state
 * @param {Array} remainingCards - Cards not yet accounted for
 * @returns {Object} - Opponent hand estimates
 */
const estimateOpponentHands = (gameState, remainingCards) => {
  const estimates = {};
  const players = ['plyr1', 'plyr2', 'plyr3', 'plyr4'];
  
  players.forEach(player => {
    if (gameState.players[player]) {
      const handSize = gameState.players[player].length;
      estimates[player] = {
        knownCards: gameState.players[player],
        handSize,
        possibleCards: remainingCards, // Simplified - could be more sophisticated
        estimatedStrength: calculateHandStrength(gameState.players[player])
      };
    }
  });
  
  return estimates;
};

/**
 * Calculate strategic strength of a hand
 * @param {Array} hand - Cards in hand
 * @returns {number} - Hand strength score
 */
const calculateHandStrength = (hand) => {
  if (!Array.isArray(hand)) return 0;
  
  return hand.reduce((total, card) => {
    return total + evaluateCard(card, [], {});
  }, 0);
};

/**
 * Enhanced helper function to check for bot pickup opportunities with intelligence
 * @param {Array} botHand - Bot's hand cards
 * @param {Array} boardCards - Cards on the board
 * @param {Object} gameContext - Game context for advanced analysis
 * @returns {Object|null} - Best pickup opportunity or null
 */
export const canBotPickup = (botHand, boardCards, gameContext = {}) => {
  console.log('DEBUG: Enhanced canBotPickup called with:');
  console.log('DEBUG: Hand cards:', botHand);
  console.log('DEBUG: Board cards:', boardCards);
  
  if (!boardCards || boardCards.length === 0) {
    console.log('DEBUG: No board cards available for pickup');
    return null;
  }
  
  let bestMove = null;
  let bestScore = -1;
  
  // Analyze all possible pickup moves and score them
  for (const handCard of botHand) {
    const handValue = getCardValue(formatCardName(handCard));
    console.log('DEBUG: Evaluating hand card:', handCard, 'value:', handValue);
    
    // Check for pickup opportunities with this hand card
    for (const boardCard of boardCards) {
      const boardValue = getCardValue(formatCardName(boardCard));
      
      if (handValue === boardValue) {
        // Use auto-expansion like human players
        const allPickupCards = findAllPickupCombinations(handValue, boardCards, [boardCard]);
        const wouldBeSeep = allPickupCards.length === boardCards.length;
        
        // Calculate strategic value of this move
        let moveScore = 0;
        
        // Score based on points collected
        moveScore += evaluateCard(handCard, [], gameContext);
        allPickupCards.forEach(card => {
          moveScore += evaluateCard(card, [], gameContext);
        });
        
        // Seep bonus (but check for penalty risk)
        if (wouldBeSeep) {
          const botTeam = ['plyr1', 'plyr3'].includes(gameContext.botPosition) ? 'team1' : 'team2';
          const seepCount = botTeam === 'team1' ? gameContext.team1SeepCount : gameContext.team2SeepCount;
          
          if (seepCount < 2) {
            moveScore += 100; // Huge bonus for beneficial seep
            console.log('DEBUG: BENEFICIAL SEEP OPPORTUNITY! Score boost:', moveScore);
          } else {
            moveScore -= 75; // Penalty for dangerous 3rd seep
            console.log('DEBUG: DANGEROUS 3RD SEEP - avoiding! Score penalty:', moveScore);
          }
        }
        
        // Prefer moves that collect more cards
        moveScore += allPickupCards.length * 2;
        
        if (moveScore > bestScore) {
          bestScore = moveScore;
          bestMove = { 
            handCard, 
            boardCards: allPickupCards,
            isSeep: wouldBeSeep,
            strategicScore: moveScore
          };
          console.log('DEBUG: New best pickup move:', bestMove);
        }
      }
    }
  }
  
  if (bestMove) {
    console.log('DEBUG: Best pickup move selected:', bestMove);
  } else {
    console.log('DEBUG: No pickup opportunities found');
  }
  
  return bestMove;
};

/**
 * HUMAN-LIKE stack creation - try combinations like humans do
 * @param {Array} botHand - Bot's hand cards
 * @param {Array} boardCards - Cards on the board
 * @param {number} call - The current call value
 * @param {Object} gameContext - Game context for strategic analysis
 * @returns {Object|null} - Valid stack opportunity or null
 */
/**
 * Bot stack creation using EXACT human functions
 * This prevents illegal stacks by using the same validation humans use
 */
export const canBotCreateStack = (botHand, boardCards, call, gameContext = {}) => {
  console.log('=== BOT USING HUMAN STACK FUNCTIONS ===');
  
  if (!boardCards || boardCards.length === 0) {
    return null;
  }
  
  // Try stack creation like humans do - attempt combinations and let validation handle it
  for (const handCard of botHand) {
    for (const boardCard of boardCards) {
      // Skip existing stacks for new stack creation
      if (typeof boardCard === 'string' && boardCard.startsWith('Stack of ')) {
        continue;
      }
      
      const selectedTableCards = [boardCard];
      
      // Test if this would work using EXACT human validation
      const attempt = testHumanStackCreation(
        handCard,
        selectedTableCards, 
        call,
        gameContext,
        botHand
      );
      
      if (attempt.isValid) {
        console.log('DEBUG: ✅ HUMAN-VALIDATED STACK:', handCard, '+', selectedTableCards, '= Stack of', attempt.stackValue);
        return {
          type: 'create',
          handCard,
          stackValue: attempt.stackValue,
          boardCards: selectedTableCards,
          strategicScore: 25
        };
      }
    }
  }
  
  // Also try adding to existing stacks
  const existingStacks = boardCards.filter(card => 
    typeof card === 'string' && card.startsWith('Stack of ')
  );
  
  for (const stack of existingStacks) {
    for (const handCard of botHand) {
      const attempt = testHumanAddToStack(handCard, stack, gameContext, botHand);
      
      if (attempt.isValid) {
        console.log('DEBUG: ✅ HUMAN-VALIDATED ADD TO STACK:', handCard, 'to', stack);
        return {
          type: 'add',
          handCard,
          targetStack: stack,
          stackValue: getStackValue(stack),
          strategicScore: 20
        };
      }
    }
  }
  
  console.log('DEBUG: No human-validated stack opportunities found');
  return null;
};

/**
 * Test stack creation using human validation functions
 */
const testHumanStackCreation = (selectedHandCard, selectedTableCards, call, gameContext, botHand) => {
  // Create a mock game state for testing
  const mockPlayers = {
    [gameContext.botPosition]: botHand,
    board: selectedTableCards // Use the board cards from context
  };
  
  const mockCollectedCards = {};
  const mockTeam1Points = 0;
  const mockTeam2Points = 0;
  const mockTeam1SeepCount = 0;
  const mockTeam2SeepCount = 0;
  const mockLastCollector = null;
  
  // Mock the confirmation function callback
  let testResult = { isValid: false };
  const mockConfirmFunction = () => {
    testResult = { isValid: true };
    return { success: true };
  };
  
  try {
    // Call the EXACT human stack validation function
    const result = confirmStack(
      null, // selectedStackToAddTo
      selectedHandCard,
      selectedTableCards,
      call,
      gameContext.moveCount || 1,
      mockPlayers,
      gameContext.botPosition,
      mockConfirmFunction, // onGameAction
      mockCollectedCards,
      mockTeam1Points,
      mockTeam2Points,
      mockTeam1SeepCount,
      mockTeam2SeepCount,
      mockLastCollector,
      mockConfirmFunction // confirmAddToStackFn
    );
    
    if (result && testResult.isValid) {
      // Calculate stack value from the result
      const handCardValue = getCardValue(formatCardName(selectedHandCard));
      const tableCardsValue = selectedTableCards.reduce((sum, card) => {
        return sum + getCardValue(formatCardName(card));
      }, 0);
      const totalStackValue = handCardValue + tableCardsValue;
      
      // Find valid stack value
      let stackValue = call;
      if ((gameContext.moveCount || 1) > 1) {
        const validValues = [9, 10, 11, 12, 13].filter(val => totalStackValue % val === 0);
        stackValue = validValues[0] || call;
      }
      
      return { isValid: true, stackValue };
    }
  } catch (error) {
    console.log('DEBUG: Human validation rejected:', error.message || 'Invalid stack');
  }
  
  return { isValid: false };
};

/**
 * Test adding to stack using human validation functions  
 */
const testHumanAddToStack = (selectedHandCard, selectedStackToAddTo, gameContext, botHand) => {
  // Create mock game state
  const mockPlayers = {
    [gameContext.botPosition]: botHand,
    board: gameContext.boardCards || []
  };
  
  let testResult = { isValid: false };
  const mockOnGameAction = () => {
    testResult = { isValid: true };
  };
  
  try {
    // Call the EXACT human add-to-stack validation function
    const result = confirmAddToStack(
      selectedStackToAddTo,
      selectedHandCard,
      [], // selectedTableCards (empty for simple add)
      mockPlayers,
      gameContext.botPosition,
      gameContext.moveCount || 1,
      mockOnGameAction,
      {},  // collectedCards
      0,   // team1Points
      0,   // team2Points  
      0,   // team1SeepCount
      0,   // team2SeepCount
      null // lastCollector
    );
    
    return { isValid: testResult.isValid };
  } catch (error) {
    console.log('DEBUG: Human add-to-stack validation rejected:', error.message || 'Invalid add');
    return { isValid: false };
  }
};

// REMOVED: Old problematic stack logic

// OLD VALIDATION FUNCTIONS REMOVED - Now using actual human functions


// DISABLED: Add-to-stack functionality to prevent illegal stacks
// Only allow creating new stacks for now


/**
 * Evaluate the strategic value of a stack move (BALANCED SCORING)
 */
const evaluateStackMove = (handCard, targetCards, gameContext, moveType) => {
  let score = 15; // Good base stack bonus to encourage stacking
  
  // Base score from card values (reduced impact)
  score += evaluateCard(handCard, [], gameContext) * 0.3;
  targetCards.forEach(card => {
    score += evaluateCard(card, [], gameContext) * 0.2; // Board cards worth less
  });
  
  // Stack-specific bonuses
  const handValue = getCardValue(formatCardName(handCard));
  
  // Universal stack bonus
  score += 10; 
  
  // Bonus for high-value stacks
  if (handValue >= 10) score += 5;
  
  // Bonus for multiple cards in stack
  score += targetCards.length * 3;
  
  // Bonus for spades stacking
  if (handCard.toLowerCase().includes('spades')) score += 4;
  
  // Move type bonuses
  switch (moveType) {
    case 'add':
      score += 8; // Adding to existing stack is good
      break;
    case 'create':
      score += 12; // Creating new stacks gets big bonus
      break;
  }
  
  // Team strategy bonus
  if (gameContext.team1Points < gameContext.team2Points && 
      ['plyr1', 'plyr3'].includes(gameContext.botPosition)) {
    score += 3; // Behind team should be more aggressive
  }
  
  console.log('DEBUG: Stack move score breakdown:', {
    handCard,
    targetCards: targetCards.length,
    moveType,
    finalScore: score
  });
  
  return Math.max(score, 2); // Ensure minimum score for any valid stack
};

/**
 * Enhanced main bot decision-making function with advanced AI
 * Implements intelligent priority system with memory and strategic analysis
 * @param {Object} gameState - Current game state
 * @param {string} botPosition - Bot's position (plyr1, plyr2, plyr3, plyr4)
 * @returns {Object} - Bot move action
 */
export const generateBotMove = (gameState, botPosition) => {
  console.log(`=== ENHANCED BOT MOVE GENERATION START (${botPosition}) ===`);
  console.log('Current game state:', {
    moveCount: gameState.moveCount,
    currentTurn: gameState.currentTurn,
    call: gameState.call,
    team1SeepCount: gameState.team1SeepCount || 0,
    team2SeepCount: gameState.team2SeepCount || 0
  });
  
  try {
    const botHand = gameState.players[botPosition];
    const currentBoard = gameState.players.board || [];
    
    if (!botHand || botHand.length === 0) {
      console.log('WARNING: Bot has no cards in hand!');
      return null;
    }
    
    // Enhanced game context for smart decisions
    const gameContext = {
      botPosition,
      call: gameState.call,
      team1SeepCount: gameState.team1SeepCount || 0,
      team2SeepCount: gameState.team2SeepCount || 0,
      moveCount: gameState.moveCount || 1,
      team1Points: gameState.team1Points || 0,
      team2Points: gameState.team2Points || 0
    };
    
    // Analyze game memory and opponent patterns
    const memoryAnalysis = analyzeGameMemory(gameState);
    console.log('Memory analysis:', {
      totalPlayed: memoryAnalysis.totalPlayed,
      remainingCount: memoryAnalysis.remainingCount
    });
    
    console.log('Enhanced bot analysis:', {
      position: botPosition,
      handSize: botHand.length,
      handCards: botHand,
      boardSize: currentBoard.length,
      boardCards: currentBoard,
      handStrength: calculateHandStrength(botHand)
    });
    
    // Check for opportunities with enhanced intelligence
    const pickupOpportunity = canBotPickup(botHand, currentBoard, gameContext);
    const stackOpportunity = canBotCreateStack(botHand, currentBoard, gameState.call, gameContext);
    
    console.log('=== DECISION ANALYSIS ===');
    console.log('Pickup opportunity:', pickupOpportunity ? `Score: ${pickupOpportunity.strategicScore}` : 'None');
    console.log('Stack opportunity:', stackOpportunity ? `Score: ${stackOpportunity.strategicScore}` : 'None');
    
    // Enhanced Priority 1: Beneficial Seeps (avoid 3rd seep penalty)
    if (pickupOpportunity && pickupOpportunity.isSeep && pickupOpportunity.strategicScore > 50) {
      console.log('DEBUG: HIGH-VALUE SEEP selected with score:', pickupOpportunity.strategicScore);
      return createPickupAction(gameState, botPosition, pickupOpportunity, true);
    }
    
    // Enhanced Priority 2: Prioritize ANY valid stack opportunity!
    if (stackOpportunity && stackOpportunity.strategicScore > 1) {
      console.log('DEBUG: 📚 STACK PRIORITIZED with score:', stackOpportunity.strategicScore);
      return createStackAction(gameState, botPosition, stackOpportunity);
    }
    
    // Priority 3: Compare remaining options  
    const pickupScore = pickupOpportunity ? pickupOpportunity.strategicScore : 0;
    const stackScore = stackOpportunity ? stackOpportunity.strategicScore : 0;
    
    // Strongly prefer stacks over most pickups
    if (stackOpportunity && (stackScore >= pickupScore * 0.7 || pickupScore < 15)) {
      console.log('DEBUG: 📚 STACK chosen over pickup - Stack score:', stackScore, 'vs Pickup score:', pickupScore);
      return createStackAction(gameState, botPosition, stackOpportunity);
    }
    
    // Priority 4: Regular pickup (when valuable)
    if (pickupOpportunity && pickupScore > 5) {
      console.log('DEBUG: PICKUP selected with score:', pickupScore);
      return createPickupAction(gameState, botPosition, pickupOpportunity, false);
    }
    
    // Priority 5: ANY remaining stack opportunity (fallback)
    if (stackOpportunity) {
      console.log('DEBUG: 📚 FALLBACK STACK selected with score:', stackScore);
      return createStackAction(gameState, botPosition, stackOpportunity);
    }
    
    // Priority 6: Any remaining pickup
    if (pickupOpportunity) {
      console.log('DEBUG: FALLBACK PICKUP selected with score:', pickupScore);
      return createPickupAction(gameState, botPosition, pickupOpportunity, false);
    }
    
    // Priority 7: Smart throw away (strategic card selection)
    console.log('DEBUG: NO GOOD MOVES - strategic throw away');
    return createThrowAwayAction(gameState, botPosition);
    
  } catch (error) {
    console.error('ERROR in enhanced generateBotMove:', error);
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
 * Enhanced stack action creator supporting multiple stack types
 * @param {Object} gameState - Current game state
 * @param {string} botPosition - Bot's position
 * @param {Object} stackOpportunity - Stack details with type
 * @returns {Object} - Stack action
 */
const createStackAction = (gameState, botPosition, stackOpportunity) => {
  const { type, handCard, stackValue } = stackOpportunity;
  
  if (type === 'add') {
    return createAddToStackAction(gameState, botPosition, stackOpportunity);
  } else {
    return createNewStackAction(gameState, botPosition, stackOpportunity);
  }
};

/**
 * Create a new stack action
 */
const createNewStackAction = (gameState, botPosition, stackOpportunity) => {
  const { handCard, stackValue, boardCards } = stackOpportunity;
  console.log('DEBUG: 📚 Bot creating NEW stack with value:', stackValue);
  
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
  
  console.log('DEBUG: 📚 Bot created NEW stack:', stackString);
  
  return {
    action: 'stack',
    players: updatedPlayers,
    currentTurn: nextPlayer,
    moveCount: gameState.moveCount + 1,
    stackValue,
    stackCards: [handCard, ...boardCards],
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
 * Add to existing stack action
 */
const createAddToStackAction = (gameState, botPosition, stackOpportunity) => {
  const { handCard, targetStack } = stackOpportunity;
  console.log('DEBUG: 📚 Bot ADDING to existing stack:', targetStack);
  
  const updatedHand = gameState.players[botPosition].filter(card => card !== handCard);
  const updatedBoard = gameState.players.board.filter(card => card !== targetStack);
  
  // Modify the existing stack string
  const newStackString = targetStack + ' + ' + handCard;
  updatedBoard.push(newStackString);
  
  const updatedPlayers = { 
    ...gameState.players,
    [botPosition]: updatedHand,
    board: updatedBoard
  };
  
  // Move to next player
  const playerOrder = ['plyr2', 'plyr3', 'plyr4', 'plyr1'];
  const currentIndex = playerOrder.indexOf(botPosition);
  const nextPlayer = playerOrder[(currentIndex + 1) % 4];
  
  console.log('DEBUG: 📚 Bot ADDED to stack, new stack:', newStackString);
  
  return {
    action: 'addToStack',
    players: updatedPlayers,
    currentTurn: nextPlayer,
    moveCount: gameState.moveCount + 1,
    originalStack: targetStack,
    addedCard: handCard,
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
 * Smart card selection for throwing away - replaces random selection
 * @param {Array} botHand - Bot's hand cards
 * @param {Array} boardCards - Current board state
 * @param {Object} gameContext - Game context for analysis
 * @returns {string} - Best card to throw away
 */
const selectSmartThrowAway = (botHand, boardCards, gameContext) => {
  console.log('DEBUG: Selecting smart throw-away from hand:', botHand);
  
  let worstCard = null;
  let worstScore = Infinity;
  
  // Evaluate each card and choose the least valuable
  botHand.forEach(card => {
    let cardScore = evaluateCard(card, boardCards, gameContext);
    
    // Penalty for cards that could help opponents
    const cardValue = getCardValue(formatCardName(card));
    const opponentCouldPickup = boardCards.some(boardCard => {
      const boardValue = getCardValue(formatCardName(boardCard));
      return boardValue === cardValue;
    });
    
    if (opponentCouldPickup) {
      cardScore += 10; // Higher score = worse to throw (helps opponents)
      console.log('DEBUG: Card', card, 'could help opponents - penalty applied');
    }
    
    // Prefer throwing non-point cards
    const cardName = card.toLowerCase();
    if (!cardName.includes('spades') && cardValue !== 1 && cardName !== '10 of diamonds') {
      cardScore -= 5; // Lower score = better to throw
    }
    
    console.log('DEBUG: Card', card, 'throw-away score:', cardScore);
    
    if (cardScore < worstScore) {
      worstScore = cardScore;
      worstCard = card;
    }
  });
  
  console.log('DEBUG: Selected card to throw away:', worstCard, 'with score:', worstScore);
  return worstCard || botHand[0]; // Fallback to first card
};

/**
 * Create a smart throw away action for the bot
 * @param {Object} gameState - Current game state
 * @param {string} botPosition - Bot's position
 * @returns {Object} - Throw away action
 */
const createThrowAwayAction = (gameState, botPosition) => {
  const botHand = gameState.players[botPosition];
  const currentBoard = gameState.players.board || [];
  
  // Use smart selection instead of random
  const gameContext = {
    botPosition,
    call: gameState.call,
    team1SeepCount: gameState.team1SeepCount || 0,
    team2SeepCount: gameState.team2SeepCount || 0
  };
  
  const cardToPlay = selectSmartThrowAway(botHand, currentBoard, gameContext);
  
  const updatedBoard = [...currentBoard, cardToPlay];
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
  
  console.log('DEBUG: Bot strategically throwing away card:', cardToPlay);
  
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