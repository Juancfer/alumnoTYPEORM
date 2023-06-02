import express, { type NextFunction, type Response, type Request } from "express";
import fs from "fs";
import multer from "multer";
import bcrypt from "bcrypt";

// Modelos
import { Author } from "../models/mongo/Author";
import { generateToken } from "../utils/token";
const upload = multer({ dest: "public" });

export const authorRouter = express.Router();

// CRUD: READ
authorRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Asi leemos query params
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const authors = await Author.find()
      .limit(limit)
      .skip((page - 1) * limit);

    // Num total de elementos
    const totalElements = await Author.countDocuments();

    const response = {
      totalItems: totalElements,
      totalPages: Math.ceil(totalElements / limit),
      currentPage: page,
      data: authors,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// CRUD: READ
authorRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const author = await Author.findById(id);
    if (author) {
      res.json(author);
    } else {
      res.status(404).json({});
    }
  } catch (error) {
    next(error);
  }
});

// CRUD: Operación custom, no es CRUD
authorRouter.get("/name/:name", async (req: Request, res: Response, next: NextFunction) => {
  const authorName = req.params.name;

  try {
    const author = await Author.find({ name: new RegExp("^" + authorName.toLowerCase(), "i") });
    if (author?.length) {
      res.json(author);
    } else {
      res.status(404).json([]);
    }
  } catch (error) {
    next(error);
  }
});

// CRUD: CREATE
authorRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const author = new Author(req.body);
    const createdAuthor = await author.save();
    return res.status(201).json(createdAuthor);
  } catch (error) {
    next(error);
  }
});

// CRUD: DELETE
authorRouter.delete("/:id", async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;

    if (req.user.id !== id && req.user.email !== "admin@gmail.com") {
      return res.status(401).json({ error: "No tienes autorización para realizar esta operación" });
    }

    const authorDeleted = await Author.findByIdAndDelete(id);
    if (authorDeleted) {
      res.json(authorDeleted);
    } else {
      res.status(404).json({});
    }
  } catch (error) {
    next(error);
  }
});

// CRUD: UPDATE
authorRouter.put("/:id", async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;

    if (req.user.id !== id && req.user.email !== "admin@gmail.com") {
      return res.status(401).json({ error: "No tienes autorización para realizar esta operación" });
    }

    const authorUpdated = await Author.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (authorUpdated) {
      res.json(authorUpdated);
    } else {
      res.status(404).json({});
    }
  } catch (error) {
    next(error);
  }
});

authorRouter.post("/image-upload", upload.single("logo"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Renombrado de la imagen
    const originalname = req.file?.originalname as string;
    const path = req.file?.path as string;
    const newPath = `${path}_${originalname}`;
    fs.renameSync(path, newPath);

    // Busqueda del autor
    const authorId = req.body.authorId;
    const author = await Author.findById(authorId);

    if (author) {
      author.profileImage = newPath;
      await author.save();
      res.json(author);

      console.log("Author modificado correctamente!");
    } else {
      fs.unlinkSync(newPath);
      res.status(404).send("Author no encontrado");
    }
  } catch (error) {
    next(error);
  }
});

// LOGIN DE USUARIOS
authorRouter.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const email = req.body.email;
    // const password = req.body.password;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Se deben especificar los campos email y password" });
    }

    const user = await Author.findOne({ email }).select("+password");
    if (!user) {
      // return res.status(404).json({ error: "No existe un usuario con ese email" });
      // Por seguridad mejor no indicar qué usuarios no existen
      return res.status(401).json({ error: "Email y/o contraseña incorrectos" });
    }

    // Comprueba la pass
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      // Quitamos password de la respuesta
      const userWithoutPass: any = user.toObject();
      delete userWithoutPass.password;

      // Generamos token JWT
      const jwtToken = generateToken(user._id.toString(), user.email);

      return res.status(200).json({ token: jwtToken });
    } else {
      return res.status(401).json({ error: "Email y/o contraseña incorrectos" });
    }
  } catch (error) {
    next(error);
  }
});
