import { UsersStorage } from "./users.storage";
import { PiecesStorage } from "./pieces.storage";
import { GalleriesStorage } from "./galleries.storage";
import { PieceTypesStorage } from "./piece-types.storage";
import { StockItemsStorage } from "./stock-items.storage";
import { StockMovementsStorage } from "./stock-movements.storage";
export type { PieceListQuery } from "./storage.base";


const users = new UsersStorage();
const pieces = new PiecesStorage();
const galleries = new GalleriesStorage();
const pieceTypes = new PieceTypesStorage();
const stockItems = new StockItemsStorage();
const stockMovements = new StockMovementsStorage();

export const storage = {
  // USERS
   getUserByUsername: (...a: Parameters<UsersStorage["getUserByUsername"]>) =>
    users.getUserByUsername(...a),
   getUserById: (...a: Parameters<UsersStorage["getUserById"]>) =>
    users.getUserById(...a),
   createUser: (...a: Parameters<UsersStorage["createUser"]>) =>
    users.createUser(...a),
   getUser: (...a: Parameters<UsersStorage["getUser"]>) =>
    users.getUser(...a),

  // PIECES
  createPiece: (...a: Parameters<PiecesStorage["createPiece"]>) =>
    pieces.createPiece(...a),
  listPieces: (...a: Parameters<PiecesStorage["listPieces"]>) =>
    pieces.listPieces(...a),
  getPieceById: (...a: Parameters<PiecesStorage["getPieceById"]>) =>
    pieces.getPieceById(...a),
  updatePiece: (...a: Parameters<PiecesStorage["updatePiece"]>) =>
    pieces.updatePiece(...a),
  deletePiece: (...a: Parameters<PiecesStorage["deletePiece"]>) =>
    pieces.deletePiece(...a),
  setPieceImage: (...a: Parameters<PiecesStorage["setPieceImage"]>) =>
    pieces.setPieceImage(...a),
  clearPieceImage: (...a: Parameters<PiecesStorage["clearPieceImage"]>) =>
    pieces.clearPieceImage(...a),

  // GALLERIES
   createGallery: (...a: Parameters<GalleriesStorage["createGallery"]>) =>
    galleries.createGallery(...a),
  listGalleries: (...a: Parameters<GalleriesStorage["listGalleries"]>) =>
    galleries.listGalleries(...a),
  updateGallery: (...a: Parameters<GalleriesStorage["updateGallery"]>) =>
    galleries.updateGallery(...a),
  deleteGallery: (...a: Parameters<GalleriesStorage["deleteGallery"]>) =>
    galleries.deleteGallery(...a),
  getGalleryById: (...a: Parameters<GalleriesStorage["getGalleryById"]>) =>
    galleries.getGalleryById(...a),

  
  // PIECE TYPES 
  createPieceType: (userId: number, d: Parameters<PieceTypesStorage["createPieceType"]>[1]) =>
    pieceTypes.createPieceType(userId, d),
  listPieceTypes: (userId: number, q?: Parameters<PieceTypesStorage["listPieceTypes"]>[1]) =>
    pieceTypes.listPieceTypes(userId, q),
  getPieceTypeById: (userId: number, id: number) =>
    pieceTypes.getPieceTypeById(userId, id),
  updatePieceType: (userId: number, id: number, patch: Parameters<PieceTypesStorage["updatePieceType"]>[2]) =>
    pieceTypes.updatePieceType(userId, id, patch),
  deletePieceType: (userId: number, id: number) =>
    pieceTypes.deletePieceType(userId, id),

    // STOCK
// ITEMS
  createStockItem:  (...a: Parameters<StockItemsStorage["createItem"]>) => stockItems.createItem(...a),
  listStockItems:   (...a: Parameters<StockItemsStorage["listItems"]>) => stockItems.listItems(...a),
  getStockItemById: (...a: Parameters<StockItemsStorage["getItemById"]>) => stockItems.getItemById(...a),
  updateStockItem:  (...a: Parameters<StockItemsStorage["updateItem"]>) => stockItems.updateItem(...a),
  deleteStockItem:  (...a: Parameters<StockItemsStorage["deleteItem"]>) => stockItems.deleteItem(...a),

  // MOVEMENTS
  createStockMovement:   (...a: Parameters<StockMovementsStorage["createMovement"]>) => stockMovements.createMovement(...a),
  listStockMovements:    (...a: Parameters<StockMovementsStorage["listMovements"]>) => stockMovements.listMovements(...a),
  getStockMovementById:  (...a: Parameters<StockMovementsStorage["getStockMovementById"]>) => stockMovements.getStockMovementById(...a),
  updateStockMovement:   (...a: Parameters<StockMovementsStorage["updateMovement"]>) => stockMovements.updateMovement(...a),
  deleteStockMovement:   (...a: Parameters<StockMovementsStorage["deleteMovement"]>) => stockMovements.deleteMovement(...a),

};




export { users, pieces, galleries, pieceTypes, stockItems, stockMovements }; 
export type AppStorage = typeof storage;