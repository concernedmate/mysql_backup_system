require('dotenv').config();
const fs = require('fs');
const mysql = require("mysql2/promise");
const child_process = require('child_process');
const path = require('path');

const getAllSchema = async () => {
    const config = {
        user: process.env.MYSQL_UID,
        password: process.env.MYSQL_PWD,
        host: process.env.MYSQL_SERVER,
        database: process.env.MYSQL_DB,
        port: process.env.MYSQL_PORT
    };

    const conn = await mysql.createConnection(config);
    const [result] = await conn.query("SHOW DATABASES");

    let schemas = [];
    for (let i = 0; i < result.length; i++) {
        if (["information_schema", "mysql", "performance_schema", "sys"].includes(result[i].Database)) continue;
        schemas.push(result[i].Database);
    }

    return schemas;
}

const readArgs = () => {
    const validArgs = ['database', '-all', '-gdrive'];
    const args = { database: '', all: false, gdrive: false };
    const read = process.argv;
    for (let i = 2; i < read.length; i++) {
        if (validArgs.indexOf(read[i]) == -1) {
            if (read[i] != '') {
                console.log(`Invalid argument ${read[i]}`);
                process.exit();
            }
        } else {
            if (read[i][0] == '-') {
                args[read[i].slice(1).toLowerCase()] = true;
            } else {
                if (read[i + 1] == undefined) {
                    console.log(`Invalid argument ${read[i]} need input`);
                    process.exit();
                } else {
                    args[read[i]] = read[i + 1];
                    i++;
                }
            }
        }
    }
    return args;
}

const startBackup = async () => {
    if (process.env.BACKUP_DIR != "") {
        console.log("CUSTOM DIR NOT YET IMPLEMENTED");
    }
    const args = readArgs();

    let command = 'mysqldump';
    if (process.env.MYSQLDUMP_LOCATION != null && process.env.MYSQLDUMP_LOCATION != '') {
        command = `"${process.env.MYSQLDUMP_LOCATION}"`;
    }

    let schemas = []
    if (args.all) {
        schemas = await getAllSchema();
    } else {
        schemas.push(args.database);
    }

    const date = new Date();
    const datetime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;

    const generated = [];
    for (let i = 0; i < schemas.length; i++) {
        const schema_name = schemas[i];
        const sql = child_process.execSync(`${command} -u ${process.env.MYSQL_UID} -p${process.env.MYSQL_PWD} ${schema_name}`).toString();

        if (!fs.existsSync(path.join(__dirname, 'backup', schema_name))) {
            fs.mkdirSync(path.join(__dirname, 'backup', schema_name), { recursive: true })
        }
        fs.writeFileSync(path.join(__dirname, 'backup', schema_name, `bak_${datetime}.sql`), sql);
        generated.push(path.join(schema_name, `bak_${datetime}.sql`));
    }
    console.log("Generated: ", generated);
    process.exit();
}

startBackup();