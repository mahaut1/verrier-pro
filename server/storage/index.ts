import { UsersStorage } from "./users.storage";
import { PiecesStorage } from "./pieces.storage";
import { GalleriesStorage } from "./galleries.storage";

const users = new UsersStorage();
const pieces = new PiecesStorage();
const galleries = new GalleriesStorage();

// (facultatif) garder un objet "storage" rétro-compatible
export const storage = {
  // USERS
  getUserByUsername: (u: string) => users.getUserByUsername(u),
  getUserById: (id: number) => users.getUserById(id),
  createUser: (i: Parameters<UsersStorage["createUser"]>[0]) => users.createUser(i),
  getUser: (u: string) => users.getUser(u),

  // PIECES
  createPiece: (userId: number, d: any) => pieces.createPiece(userId, d),
  listPieces: (userId: number, q?: any) => pieces.listPieces(userId, q),
  getPieceById: (userId: number, id: number) => pieces.getPieceById(userId, id),
  updatePiece: (userId: number, id: number, patch: any) => pieces.updatePiece(userId, id, patch),
  deletePiece: (userId: number, id: number) => pieces.deletePiece(userId, id),
  setPieceImage: (userId: number, id: number, url: string) => pieces.setPieceImage(userId, id, url),
  clearPieceImage: (userId: number, id: number) => pieces.clearPieceImage(userId, id),

  // GALLERIES
  createGallery: (userId: number, d: any) => galleries.createGallery(userId, d),
  listGalleries: (userId: number, q?: any) => galleries.listGalleries(userId, q),
  updateGallery: (userId: number, id: number, patch: any) => galleries.updateGallery(userId, id, patch),
  deleteGallery: (userId: number, id: number) => galleries.deleteGallery(userId, id),
  getGalleryById: (userId: number, id: number) => galleries.getGalleryById(userId, id),
};

export { users, pieces, galleries }; // si tu veux aussi accès direct
