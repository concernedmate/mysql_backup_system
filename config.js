const mysql_config = {
    user: 'root',
    password: 'root',
    host: 'localhost',
    port: '3306'
}

const mysqldump_location = "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump"

const KEY_NAME = ""
const USER_NAME = ""
const HOST_NAME = ""
const PORT = "22"

const BACKUP_CLIENT_NAME = ""

module.exports = { mysql_config, mysqldump_location, KEY_NAME, HOST_NAME, USER_NAME, PORT, BACKUP_CLIENT_NAME }