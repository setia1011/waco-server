var config = {
    debug: true,
    database: {
        connectionLimit: 500,
	    host: "localhost",
	    user: "setia",
	    password: "123456",
	    database: "waxyz",
	    charset : "utf8mb4",
	    debug: false,
	    waitForConnections: true,
	    multipleStatements: true
    },
    cors: {
		origin: '*',
 		optionsSuccessStatus: 200
	}
}

module.exports = config; 