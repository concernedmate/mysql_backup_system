require('dotenv').config();
const fs = require('fs');
const mysql = require("mysql2/promise");
const child_process = require('child_process');
const path = require('path');
const { mysql_config, mysqldump_location } = require('./config');

const getAllSchema = async () => {
    const config = mysql_config;

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
    if (mysqldump_location != null && mysqldump_location != '') {
        command = `${mysqldump_location}`;
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
        if (!fs.existsSync(path.join(__dirname, 'backup', schema_name))) {
            fs.mkdirSync(path.join(__dirname, 'backup', schema_name), { recursive: true })
        }
        const backup = async () => {
            const sql = child_process.spawn(`${command}`, [
                '-u',
                `${process.env.MYSQL_UID}`,
                `-p${process.env.MYSQL_PWD}`,
                `${schema_name}`
            ]);
            const wstream = fs.createWriteStream(path.join(__dirname, 'backup', schema_name, `bak_${datetime}.sql`));

            return new Promise((resolve, reject) => {
                // sql.stdout.on('error', reject).pipe(wstream);

                // we pipe manual
                let written = 0;
                sql.stdout.on('data', (data) => {
                    wstream.write(data, () => {
                        written += data.length;
                        console.log(`Schema ${schema_name} processed: ${written}`);
                    });
                })
                sql.stdout.on('error', reject);
                sql.stdout.on('finish', resolve);
            })
        }

        try {
            await backup();
            generated.push(path.join(__dirname, 'backup', schema_name, `bak_${datetime}.sql`));
        } catch (error) {
            console.log(`Failed to generate backup for: ${schema_name}`);
        }
        // fs.writeFileSync(path.join(__dirname, 'backup', schema_name, `bak_${datetime}.sql`), sql);
    }
    console.log("Generated: ", generated);
    process.exit();
}

startBackup();