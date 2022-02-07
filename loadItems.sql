SET GLOBAL local_infile =1;
USE zanderdev;
LOAD DATA LOCAL INFILE 'assets/minecraft/mcimages.csv'
INTO TABLE minecraftItems
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(name, idName, id, dataValue, imagePath);
SET GLOBAL local_infile =0;