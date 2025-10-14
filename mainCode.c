#include "stm32f4xx.h"
#include <stdio.h>

// Sensor addresses
#define BMP280_ADDR1  (0x76 << 1)
#define BMP280_ADDR2  (0x77 << 1)

// Registers
#define REG_ID        0xD0
#define REG_RESET     0xE0
#define REG_CTRL_MEAS 0xF4
#define REG_TEMP_MSB  0xFA

// UART and I2C
void delay_ms(uint32_t ms);
void UART2_Init(void);
void UART2_SendChar(char c);
void UART2_SendString(char *str);
void I2C1_Init(void);
uint8_t I2C1_ReadReg(uint8_t devAddr, uint8_t regAddr);
void I2C1_WriteReg(uint8_t devAddr, uint8_t regAddr, uint8_t data);

// BMP280 functions
void read_calibration(uint8_t addr, uint16_t *T1, int16_t *T2, int16_t *T3);
int32_t read_raw_temperature(uint8_t addr);
float compensate_T(int32_t adc_T, uint16_t T1, int16_t T2, int16_t T3, int32_t *t_fine);

// Calibration variables
uint16_t dig_T1_1, dig_T1_2;
int16_t dig_T2_1, dig_T2_2, dig_T3_1, dig_T3_2;
int32_t t_fine_1, t_fine_2;

int main(void)
{
    char msg[80];
    RCC->AHB1ENR |= (1<<0)|(1<<1); // GPIOA,B clocks

    UART2_Init();
    I2C1_Init();

    UART2_SendString("BMP280 Dual Sensor Temp Start\r\n");

    // Check both sensors
    uint8_t id1 = I2C1_ReadReg(BMP280_ADDR1, REG_ID);
    sprintf(msg,"Sensor1 ID=0x%02X\r\n", id1);
    UART2_SendString(msg);

    uint8_t id2 = I2C1_ReadReg(BMP280_ADDR2, REG_ID);
    sprintf(msg,"Sensor2 ID=0x%02X\r\n", id2);
    UART2_SendString(msg);

    if(id1 != 0x58 || id2 != 0x58)
    {
        UART2_SendString("Check wiring or addresses!\r\n");
        while(1);
    }

    // Reset and configure both sensors
    I2C1_WriteReg(BMP280_ADDR1, REG_RESET, 0xB6);
    I2C1_WriteReg(BMP280_ADDR2, REG_RESET, 0xB6);
    delay_ms(100);
    I2C1_WriteReg(BMP280_ADDR1, REG_CTRL_MEAS, 0x27);
    I2C1_WriteReg(BMP280_ADDR2, REG_CTRL_MEAS, 0x27);

    // Read calibration for both sensors
    read_calibration(BMP280_ADDR1, &dig_T1_1, &dig_T2_1, &dig_T3_1);
    read_calibration(BMP280_ADDR2, &dig_T1_2, &dig_T2_2, &dig_T3_2);

    // --- New logic: 2-minute reading session ---
    UART2_SendString("Reading sensor data for 2 minutes...\r\n");

    float sum_temp = 0.0f;
    uint32_t count = 0;

    // precisely 120 readings spaced ~1 second apart
    for(uint32_t i = 0; i < 120; i++)
    {
        int32_t raw1 = read_raw_temperature(BMP280_ADDR1);
        float temp1 = compensate_T(raw1, dig_T1_1, dig_T2_1, dig_T3_1, &t_fine_1);

        int32_t raw2 = read_raw_temperature(BMP280_ADDR2);
        float temp2 = compensate_T(raw2, dig_T1_2, dig_T2_2, dig_T3_2, &t_fine_2);

        sum_temp += (temp1 + temp2) / 2.0f;
        count++;

        // short message every 10 sec just to see progress
        if((i % 10) == 0)
        {
            sprintf(msg, "Progress: %lus / 120s\r\n", (unsigned long)i);
            UART2_SendString(msg);
        }

        delay_ms(1000);  // 1 sec between readings
    }

    float average_temp = sum_temp / (float)count;
    sprintf(msg, "\r\n=== 2-minute Average Temperature: %.2f °C ===\r\n", average_temp);
    UART2_SendString(msg);

    while(1); // stop here
}

//---------------- UART -----------------
void UART2_Init(void)
{
    RCC->APB1ENR |= (1<<17);
    GPIOA->MODER |= (2<<4)|(2<<6);
    GPIOA->AFR[0] |= (7<<8)|(7<<12);
    USART2->BRR = 0x0683; 
    USART2->CR1 = (1<<3)|(1<<2)|(1<<13);
}
void UART2_SendChar(char c){ while(!(USART2->SR&(1<<7))); USART2->DR=c; }
void UART2_SendString(char *s){ while(*s) UART2_SendChar(*s++); }

//---------------- I2C -----------------
void I2C1_Init(void)
{
    RCC->APB1ENR |= (1<<21);
    GPIOB->MODER |= (2<<16)|(2<<18);
    GPIOB->OTYPER |= (1<<8)|(1<<9);
    GPIOB->AFR[1] |= (4<<0)|(4<<4);
    GPIOB->PUPDR |= (1<<16)|(1<<18);

    I2C1->CR2 = 16;
    I2C1->CCR = 80;
    I2C1->TRISE = 17;
    I2C1->CR1 = 1;
}

void I2C1_WriteReg(uint8_t devAddr, uint8_t regAddr, uint8_t data)
{
    I2C1->CR1 |= (1<<8);
    while(!(I2C1->SR1&(1<<0)));
    I2C1->DR = devAddr;
    while(!(I2C1->SR1&(1<<1))); (void)I2C1->SR2;
    while(!(I2C1->SR1&(1<<7))); I2C1->DR = regAddr;
    while(!(I2C1->SR1&(1<<7))); I2C1->DR = data;
    while(!(I2C1->SR1&(1<<2))); I2C1->CR1 |= (1<<9);
}

uint8_t I2C1_ReadReg(uint8_t devAddr, uint8_t regAddr)
{
    uint8_t data;
    I2C1->CR1 |= (1<<8); while(!(I2C1->SR1&(1<<0)));
    I2C1->DR = devAddr; while(!(I2C1->SR1&(1<<1))); (void)I2C1->SR2;
    while(!(I2C1->SR1&(1<<7))); I2C1->DR = regAddr;
    while(!(I2C1->SR1&(1<<2)));
    I2C1->CR1 |= (1<<8); while(!(I2C1->SR1&(1<<0)));
    I2C1->DR = devAddr|1; while(!(I2C1->SR1&(1<<1))); (void)I2C1->SR2;
    I2C1->CR1 &= ~(1<<10); I2C1->CR1 |= (1<<9);
    while(!(I2C1->SR1&(1<<6))); data = I2C1->DR;
    return data;
}

//---------------- BMP280 -----------------
void read_calibration(uint8_t addr, uint16_t *T1, int16_t *T2, int16_t *T3)
{
    *T1 = I2C1_ReadReg(addr, 0x88) | (I2C1_ReadReg(addr, 0x89)<<8);
    *T2 = I2C1_ReadReg(addr, 0x8A) | (I2C1_ReadReg(addr, 0x8B)<<8);
    *T3 = I2C1_ReadReg(addr, 0x8C) | (I2C1_ReadReg(addr, 0x8D)<<8);
}

int32_t read_raw_temperature(uint8_t addr)
{
    int32_t adc_T = ((uint32_t)I2C1_ReadReg(addr, 0xFA)<<12) |
                    ((uint32_t)I2C1_ReadReg(addr, 0xFB)<<4) |
                    ((I2C1_ReadReg(addr,0xFC)>>4)&0x0F);
    return adc_T;
}

float compensate_T(int32_t adc_T, uint16_t T1, int16_t T2, int16_t T3, int32_t *t_fine)
{
    float var1 = (((float)adc_T)/16384.0 - ((float)T1)/1024.0) * ((float)T2);
    float var2 = ((((float)adc_T)/131072.0 - ((float)T1)/8192.0) *
                  (((float)adc_T)/131072.0 - ((float)T1)/8192.0)) * ((float)T3);
    *t_fine = (int32_t)(var1 + var2);
    return (var1+var2)/5120.0;
}

//---------------- Delay -----------------
void delay_ms(uint32_t ms)
{
    // ~1 ms accurate at 16 MHz core clock
    SysTick->LOAD = 16000 - 1;
    SysTick->VAL = 0;
    SysTick->CTRL = 5;  // enable, use CPU clock
    for(uint32_t i=0;i<ms;i++){
        while(!(SysTick->CTRL & (1<<16)));
    }
    SysTick->CTRL = 0;
}