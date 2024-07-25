const fs = require('fs');
const mysql = require("mysql2/promise");
const child_process = require('child_process');
const path = require('path');
const { mysql_config, mysqldump_location, KEY_NAME, HOST_NAME, USER_NAME, PORT } = require('./config');

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
    const validArgs = ['database', '-all', '-upload'];
    const args = { database: '', all: false, upload: false };
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
                `${mysql_config.user}`,
                `-p${mysql_config.password}`,
                `${schema_name}`,
                `--no-tablespaces`,
                `--single-transaction`
            ]);
            const wstream = fs.createWriteStream(path.join(__dirname, 'backup', schema_name, `bak_${datetime}.sql`));

            return new Promise((resolve, reject) => {
                // we pipe manual
                let written = 0;
                sql.stdout.on('data', (data) => {
                    wstream.write(data, () => {
                        written += data.length;
                        console.log(`\x1B[2J\x1B[H`) // clear console
                        console.log(`Schema ${schema_name} processed: ${written}`);
                    });
                })
                sql.stdout.on('error', (error) => {
                    reject(`Error!: ${error}`);
                });
                sql.stdout.on('finish', () => {
                    resolve(resolve(path.join(__dirname, 'backup', schema_name, `bak_${datetime}.sql`)));
                });
            })
        }

        try {
            const path = await backup();
            generated.push({
                path,
                schema_name
            });
            console.log("Generated: ", path);
        } catch (error) {
            console.log(`Failed to generate backup for: ${schema_name}`);
        }
    }

    if (args.upload) {
        for (let i = 0; i < generated.length; i++) {
            try {
                const a = async () => {
                    const upload = child_process.exec(`cat ${generated[i].path} | ssh -i "${KEY_NAME}" ${USER_NAME}@${HOST_NAME} ${PORT != null && PORT != "" ? `-p ${PORT}` : ``} "cd /home/${USER_NAME}/mysql_system_backup/ && cat -> ${generated[i].schema_name}_${datetime}.sql"`);
                    return new Promise((resolve, reject) => {
                        upload.stdout.on('error', (error) => {
                            reject(error);
                        });
                        upload.stdout.on('finish', () => {
                            resolve(`Backup ${generated[i].schema_name} uploaded`)
                        });
                    })
                }
                console.log(await a());
            } catch (error) {
                console.log(`Failed to upload backup ${generated[i].schema_name}`);
            }
        }
    }
    process.exit();
}

startBackup();