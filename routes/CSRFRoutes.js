import express from "express"

const CSRFRoutes = express.Router()

CSRFRoutes.get("/csrf-token", (req, res) => {
	res.json({ csrfToken: req.csrfToken() });
})

export default CSRFRoutes